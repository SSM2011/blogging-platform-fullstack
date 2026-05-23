#!/bin/bash
set -euo pipefail

# Updates image tags in Kustomize overlays
# Usage: ./update-manifests.sh <environment> <image-name> <new-tag> <ecr-registry>
# Example: ./update-manifests.sh production blogging-platform/backend build-42-abc1234 123456789.dkr.ecr.ap-south-1.amazonaws.com

ENVIRONMENT="${1:?Usage: $0 <environment> <image-name> <new-tag> <ecr-registry>}"
IMAGE_NAME="${2:?Usage: $0 <environment> <image-name> <new-tag> <ecr-registry>}"
NEW_TAG="${3:?Usage: $0 <environment> <image-name> <new-tag> <ecr-registry>}"
ECR_REGISTRY="${4:?Usage: $0 <environment> <image-name> <new-tag> <ecr-registry>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OVERLAY_PATH="${REPO_ROOT}/infrastructure/kubernetes/overlays/${ENVIRONMENT}"

if [ ! -d "${OVERLAY_PATH}" ]; then
    echo "ERROR: Overlay path does not exist: ${OVERLAY_PATH}"
    exit 1
fi

echo "Updating ${IMAGE_NAME} to tag ${NEW_TAG} in ${ENVIRONMENT} overlay..."

cd "${OVERLAY_PATH}"

FULL_IMAGE="${ECR_REGISTRY}/${IMAGE_NAME}"

# Update the image tag in kustomization.yaml
if command -v kustomize &> /dev/null; then
    kustomize edit set image "${IMAGE_NAME}=${FULL_IMAGE}:${NEW_TAG}"
else
    # Fallback: use sed to update the tag
    sed -i "s|newName: .*${IMAGE_NAME}|newName: ${FULL_IMAGE}|g" kustomization.yaml
    sed -i "/newName: ${FULL_IMAGE//\//\\/}/{n;s|newTag: .*|newTag: ${NEW_TAG}|}" kustomization.yaml
fi

echo "Successfully updated ${IMAGE_NAME} to ${FULL_IMAGE}:${NEW_TAG}"
echo "Updated file: ${OVERLAY_PATH}/kustomization.yaml"
