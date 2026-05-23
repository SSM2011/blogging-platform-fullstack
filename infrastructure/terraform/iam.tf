resource "aws_iam_role" "jenkins_ci" {
  name = "${var.project_name}-${var.environment}-jenkins-ci"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-jenkins-ci"
  }
}

resource "aws_iam_policy" "jenkins_ecr" {
  name        = "${var.project_name}-${var.environment}-jenkins-ecr"
  description = "Allow Jenkins to push/pull images from ECR"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeImages",
          "ecr:StartImageScan",
          "ecr:DescribeImageScanFindings"
        ]
        Resource = [
          aws_ecr_repository.frontend.arn,
          aws_ecr_repository.backend.arn
        ]
      }
    ]
  })
}

resource "aws_iam_policy" "jenkins_eks" {
  name        = "${var.project_name}-${var.environment}-jenkins-eks"
  description = "Allow Jenkins to interact with EKS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster",
          "eks:ListClusters"
        ]
        Resource = module.eks.cluster_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "jenkins_ecr" {
  role       = aws_iam_role.jenkins_ci.name
  policy_arn = aws_iam_policy.jenkins_ecr.arn
}

resource "aws_iam_role_policy_attachment" "jenkins_eks" {
  role       = aws_iam_role.jenkins_ci.name
  policy_arn = aws_iam_policy.jenkins_eks.arn
}

resource "aws_iam_instance_profile" "jenkins_ci" {
  name = "${var.project_name}-${var.environment}-jenkins-ci"
  role = aws_iam_role.jenkins_ci.name
}

module "backend_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "${var.project_name}-${var.environment}-backend-s3"

  role_policy_arns = {
    s3_access = aws_iam_policy.backend_s3.arn
  }

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["blogging-platform:blogging-backend-sa"]
    }
  }
}

resource "aws_iam_policy" "backend_s3" {
  name        = "${var.project_name}-${var.environment}-backend-s3"
  description = "Allow backend pods to access S3 for media uploads"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::my-fullstack-blogging-platform",
          "arn:aws:s3:::my-fullstack-blogging-platform/*"
        ]
      }
    ]
  })
}
