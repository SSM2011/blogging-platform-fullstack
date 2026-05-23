#!/bin/bash
set -euo pipefail

# Bootstrap script for Blogging Platform DevSecOps infrastructure
# This script provisions the complete infrastructure from scratch

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
INFRA_DIR="${REPO_ROOT}/infrastructure"

AWS_REGION="${AWS_REGION:-ap-south-1}"
ENVIRONMENT="${ENVIRONMENT:-production}"
CLUSTER_NAME="blogging-platform-${ENVIRONMENT}-eks"

echo "============================================"
echo "  Blogging Platform Infrastructure Setup"
echo "  Environment: ${ENVIRONMENT}"
echo "  Region: ${AWS_REGION}"
echo "============================================"

# ------------------------------------------
# Step 1: Terraform Infrastructure
# ------------------------------------------
echo ""
echo "[Step 1/7] Provisioning infrastructure with Terraform..."
cd "${INFRA_DIR}/terraform"

terraform init

terraform plan \
    -var="environment=${ENVIRONMENT}" \
    -var="aws_region=${AWS_REGION}" \
    -out=tfplan

echo ""
read -p "Review the plan above. Apply? (yes/no): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

terraform apply tfplan

# Get outputs
ECR_FRONTEND_URL=$(terraform output -raw ecr_frontend_repository_url)
ECR_BACKEND_URL=$(terraform output -raw ecr_backend_repository_url)
EKS_CLUSTER_NAME=$(terraform output -raw eks_cluster_name)

echo "ECR Frontend: ${ECR_FRONTEND_URL}"
echo "ECR Backend: ${ECR_BACKEND_URL}"
echo "EKS Cluster: ${EKS_CLUSTER_NAME}"

# ------------------------------------------
# Step 2: Configure kubectl
# ------------------------------------------
echo ""
echo "[Step 2/7] Configuring kubectl for EKS..."
aws eks update-kubeconfig \
    --name "${EKS_CLUSTER_NAME}" \
    --region "${AWS_REGION}" \
    --alias "${CLUSTER_NAME}"

kubectl cluster-info
echo "kubectl configured successfully."

# ------------------------------------------
# Step 3: Install NGINX Ingress Controller
# ------------------------------------------
echo ""
echo "[Step 3/7] Installing NGINX Ingress Controller..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx \
    --create-namespace \
    --set controller.replicaCount=2 \
    --set controller.service.type=LoadBalancer \
    --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-type"=nlb \
    --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-scheme"=internet-facing \
    --set controller.metrics.enabled=true \
    --set controller.metrics.serviceMonitor.enabled=true \
    --wait

echo "Ingress controller installed."

# ------------------------------------------
# Step 4: Install cert-manager
# ------------------------------------------
echo ""
echo "[Step 4/7] Installing cert-manager..."
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm upgrade --install cert-manager jetstack/cert-manager \
    --namespace cert-manager \
    --create-namespace \
    --set installCRDs=true \
    --set replicaCount=2 \
    --wait

# Create ClusterIssuer for Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@developersubodh.in
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: nginx
EOF

echo "cert-manager installed with Let's Encrypt issuer."

# ------------------------------------------
# Step 5: Install ArgoCD
# ------------------------------------------
echo ""
echo "[Step 5/7] Installing ArgoCD..."
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

helm upgrade --install argocd argo/argo-cd \
    --namespace argocd \
    --create-namespace \
    --set server.service.type=LoadBalancer \
    --set server.extraArgs[0]="--insecure" \
    --set configs.params."server\.insecure"=true \
    --set controller.metrics.enabled=true \
    --set server.metrics.enabled=true \
    --wait

# Get initial admin password
echo ""
echo "ArgoCD initial admin password:"
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo ""

# Apply ArgoCD project and applications
kubectl apply -f "${INFRA_DIR}/argocd/project.yaml"
kubectl apply -f "${INFRA_DIR}/argocd/application-${ENVIRONMENT}.yaml"

echo "ArgoCD installed and applications configured."

# ------------------------------------------
# Step 6: Install Monitoring Stack
# ------------------------------------------
echo ""
echo "[Step 6/7] Installing Prometheus + Grafana monitoring..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
    --namespace monitoring \
    --create-namespace \
    -f "${INFRA_DIR}/monitoring/prometheus/values.yaml" \
    --wait

# Apply ServiceMonitors
kubectl apply -f "${INFRA_DIR}/monitoring/prometheus/servicemonitor.yaml"

echo "Monitoring stack installed."

# ------------------------------------------
# Step 7: Create Application Namespace & Secrets
# ------------------------------------------
echo ""
echo "[Step 7/7] Creating application namespace and secrets..."
kubectl create namespace blogging-platform --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "IMPORTANT: Create the following secrets manually:"
echo ""
echo "  kubectl -n blogging-platform create secret generic backend-secrets \\"
echo "    --from-literal=DB_LOCATION='<mongodb-atlas-uri>' \\"
echo "    --from-literal=SECRET_ACCESS_KEY='<jwt-secret>'"
echo ""
echo "  kubectl -n blogging-platform create secret generic firebase-credentials \\"
echo "    --from-file=firebase-adminsdk.json=<path-to-firebase-json>"
echo ""

# ------------------------------------------
# Summary
# ------------------------------------------
echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "Infrastructure:"
echo "  - EKS Cluster: ${EKS_CLUSTER_NAME}"
echo "  - ECR Frontend: ${ECR_FRONTEND_URL}"
echo "  - ECR Backend: ${ECR_BACKEND_URL}"
echo ""
echo "Services:"
echo "  - NGINX Ingress: $(kubectl -n ingress-nginx get svc ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo 'pending')"
echo "  - ArgoCD: $(kubectl -n argocd get svc argocd-server -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo 'pending')"
echo ""
echo "Next steps:"
echo "  1. Point DNS records to the Ingress load balancer"
echo "  2. Create Kubernetes secrets (see commands above)"
echo "  3. Configure Jenkins with AWS credentials and ArgoCD token"
echo "  4. Push code to trigger the CI/CD pipeline"
echo "============================================"
