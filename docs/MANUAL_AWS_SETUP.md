# 🔴 Manual AWS Setup Guide for Wuxia MUD

> **Purpose**: One-time AWS account setup required before any Terraform or CI/CD can run.
> **Estimated time**: 30–45 minutes
> **Prerequisites**: AWS CLI installed and configured with AdministratorAccess credentials

---

## Table of Contents

1. [Create S3 Bucket for Terraform State](#step-1-create-s3-bucket-for-terraform-state)
2. [Add GitHub OIDC Provider to AWS IAM](#step-2-add-github-oidc-provider-to-aws-iam)
3. [Add GitHub Secret](#step-3-add-github-secret-aws_account_id)
4. [(Optional) Request ACM Certificate for HTTPS](#step-4-optional-request-acm-certificate-for-https)
5. [Verify Everything is Ready](#step-5-verify-everything-is-ready)
6. [Troubleshooting](#troubleshooting)

---

## Step 1: Create S3 Bucket for Terraform State

### Why Manual
Terraform stores its state file in S3, but Terraform cannot create its own backend bucket (chicken-and-egg problem). You must create it manually first.

### Commands

```bash
# Set your region (must match terraform/main.tf)
export AWS_REGION=ap-southeast-1

# Create the bucket
aws s3 mb s3://wuxia-mud-terraform-state --region $AWS_REGION

# Enable versioning (protects against accidental state deletion)
aws s3api put-bucket-versioning \
  --bucket wuxia-mud-terraform-state \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket wuxia-mud-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Block public access
aws s3api put-public-access-block \
  --bucket wuxia-mud-terraform-state \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### Verify

```bash
aws s3api get-bucket-versioning --bucket wuxia-mud-terraform-state
# Expected output: {"Status": "Enabled"}

aws s3 ls s3://wuxia-mud-terraform-state
# Expected: empty or no error
```

### Checklist
- [ ] Bucket `wuxia-mud-terraform-state` created
- [ ] Versioning enabled
- [ ] Encryption enabled
- [ ] Public access blocked

---

## Step 2: Add GitHub OIDC Provider to AWS IAM

### Why Manual
The GitHub Actions workflow uses OIDC (OpenID Connect) to authenticate with AWS without storing long-lived access keys. This requires adding GitHub as an identity provider in your AWS account — a one-time account-level setup.

### Option A: AWS CLI (Recommended)

```bash
# Get the thumbprint for GitHub's OIDC provider
# This is a SHA-1 hash of GitHub's certificate
THUMBPRINT=$(openssl s_client -servername token.actions.githubusercontent.com \
  -connect token.actions.githubusercontent.com:443 2>/dev/null </dev/null |
  openssl x509 -fingerprint -noout 2>/dev/null |
  sed 's/SHA1 Fingerprint=//g' | sed 's/://g' | tr 'A-Z' 'a-z')

echo "Thumbprint: $THUMBPRINT"
# Expected: 6938fd4e98bab03faadb97b34396831e3780aea1

# Create the OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --thumbprint-list $THUMBPRINT \
  --client-id-list sts.amazonaws.com

# Save the ARN for later
OIDC_ARN=$(aws iam list-open-id-connect-providers \
  --query 'OpenIDConnectProviderList[0].Arn' --output text)
echo "OIDC Provider ARN: $OIDC_ARN"
```

### Option B: AWS Console

1. Go to **AWS Console → IAM → Identity Providers**
2. Click **Add Provider**
3. Provider type: **OpenID Connect**
4. Provider URL: `https://token.actions.githubusercontent.com`
5. Click **Get thumbprint** (should show: `6938fd4e98bab03faadb97b34396831e3780aea1`)
6. Audience: `sts.amazonaws.com`
7. Click **Add provider**

### Verify

```bash
aws iam list-open-id-connect-providers
# Expected output: JSON with the provider ARN

aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn $OIDC_ARN
# Expected: JSON with URL, ClientIDList, ThumbprintList
```

### Checklist
- [ ] OIDC provider created for `token.actions.githubusercontent.com`
- [ ] Thumbprint verified: `6938fd4e98bab03faadb97b34396831e3780aea1`
- [ ] Audience set to `sts.amazonaws.com`

---

## Step 3: Add GitHub Secret (`AWS_ACCOUNT_ID`)

### Why Manual
GitHub secrets can only be set via the GitHub UI or API with a personal access token. Terraform cannot create GitHub secrets.

### Step 3.1: Get Your AWS Account ID

```bash
# Method 1: AWS CLI
aws sts get-caller-identity --query Account --output text
# Example output: 123456789012

# Method 2: AWS Console
# Look at the top-right corner of any AWS Console page
```

Save this 12-digit number — you'll need it in the next step.

### Step 3.2: Add Secret to GitHub

**Via GitHub Web UI:**

1. Go to your GitHub repo: `https://github.com/yongouyang/mud_game`
2. Click **Settings** (top tab)
3. In the left sidebar, click **Secrets and variables → Actions**
4. Click **New repository secret**
5. Fill in:
   - **Name**: `AWS_ACCOUNT_ID`
   - **Value**: your 12-digit AWS account ID (e.g., `123456789012`)
6. Click **Add secret**

**Via GitHub CLI (if installed):**

```bash
gh secret set AWS_ACCOUNT_ID \
  --repo yongouyang/mud_game \
  --body "123456789012"
```

### Verify

```bash
gh secret list --repo yongouyang/mud_game
# Expected: AWS_ACCOUNT_ID should appear in the list
```

Or check the web UI: Settings → Secrets and variables → Actions → should see `AWS_ACCOUNT_ID` in the list.

### Checklist
- [ ] AWS account ID obtained (12 digits)
- [ ] Secret `AWS_ACCOUNT_ID` added to GitHub repo
- [ ] Secret visible in GitHub Settings → Secrets → Actions

---

## Step 4: (Optional) Request ACM Certificate for HTTPS

### Why Manual
ACM certificate validation requires either DNS confirmation (adding a CNAME record) or email confirmation. This cannot be fully automated unless you also control the DNS via Route 53.

### When You Need This
- Only if you want HTTPS on your ALB (required for payment callbacks like WeChat/Alipay)
- If you're fine with HTTP for now, skip this step

### Commands

```bash
# Request a certificate
aws acm request-certificate \
  --domain-name your-domain.com \
  --validation-method DNS \
  --region ap-southeast-1 \
  --query CertificateArn --output text

# Example output:
# arn:aws:acm:ap-southeast-1:123456789012:certificate/abcd1234-5678-90ab-cdef-example11111
```

### Validation Steps

After requesting, you must validate ownership. The method depends on your setup:

**If using Route 53 (AWS DNS):**
```bash
# Get the validation CNAME records
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:ap-southeast-1:123456789012:certificate/abcd1234-... \
  --query 'Certificate.DomainValidationOptions'

# Add the CNAME records to Route 53
# (This part is manual in the Route 53 console or via separate CLI commands)
```

**If using external DNS (Cloudflare, GoDaddy, etc.):**
1. Go to AWS Console → ACM → Certificates
2. Click your certificate
3. Copy the CNAME name and value
4. Add them as a CNAME record in your DNS provider
5. Wait for validation (can take minutes to hours)

### Pass Certificate to Terraform

Once validated, add the certificate ARN to your Terraform variables:

```bash
# Option 1: terraform.tfvars file
echo 'certificate_arn = "arn:aws:acm:ap-southeast-1:123456789012:certificate/abcd1234-..."' > terraform/terraform.tfvars

# Option 2: Command line
terraform apply -var="certificate_arn=arn:aws:acm:ap-southeast-1:123456789012:certificate/abcd1234-..."
```

### Checklist
- [ ] Certificate requested (optional)
- [ ] Domain validation completed (optional)
- [ ] Certificate ARN saved for Terraform (optional)

---

## Step 5: Verify Everything is Ready

Run this checklist before proceeding to Terraform:

```bash
echo "=== Checking S3 Bucket ==="
aws s3api get-bucket-versioning --bucket wuxia-mud-terraform-state

echo "=== Checking OIDC Provider ==="
aws iam list-open-id-connect-providers

echo "=== Checking AWS Account ID ==="
aws sts get-caller-identity --query Account --output text

echo "=== Checking GitHub Secret ==="
gh secret list --repo yongouyang/mud_game 2>/dev/null || echo "Install gh CLI or check web UI"
```

### Final Checklist

| # | Item | How to Verify |
|---|------|-------------|
| 1 | S3 bucket exists with versioning | `aws s3api get-bucket-versioning --bucket wuxia-mud-terraform-state` |
| 2 | OIDC provider created | `aws iam list-open-id-connect-providers` shows GitHub URL |
| 3 | GitHub secret `AWS_ACCOUNT_ID` set | GitHub Settings → Secrets → Actions |
| 4 | (Optional) ACM certificate validated | AWS Console → ACM → Certificate status = "Issued" |

**If all items are checked, you can now proceed to Step 10 (Terraform) in IMPLEMENTATION_STEPS.md.**

---

## Troubleshooting

### Problem: `aws s3 mb` fails with "BucketAlreadyExists"
**Cause**: S3 bucket names are globally unique. Someone else (or you) already created this bucket.  
**Fix**: Use a different bucket name. Update `terraform/main.tf` backend block:
```hcl
backend "s3" {
  bucket = "your-unique-bucket-name-wuxia-mud"
  key    = "prod/terraform.tfstate"
  region = "ap-southeast-1"
}
```

### Problem: `aws iam create-open-id-connect-provider` fails with "EntityAlreadyExists"
**Cause**: The OIDC provider already exists.  
**Fix**: This is fine — skip to the verify step. You only need one GitHub OIDC provider per AWS account.

### Problem: GitHub Actions workflow fails with "Could not assume role"
**Cause**: The IAM role trust policy doesn't match the OIDC provider, or the GitHub repo name is wrong.  
**Fix**: Check the `aws_iam_role.github_actions` resource in `terraform/main.tf`. Ensure:
- The OIDC provider ARN matches what you created
- The `StringLike` condition matches your repo: `repo:yongouyang/mud_game:*`

### Problem: Terraform init fails with "No valid credential sources found"
**Cause**: AWS CLI credentials not configured.  
**Fix**: Run `aws configure` or set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables.

### Problem: Certificate validation stuck in "Pending validation"
**Cause**: DNS CNAME record not propagated yet.  
**Fix**: Wait longer (up to 24 hours for DNS propagation). Verify the CNAME record exists with:
```bash
dig CNAME _abcd1234.your-domain.com
```

---

## Quick Reference Card

| Task | Command |
|------|---------|
| Get AWS account ID | `aws sts get-caller-identity --query Account --output text` |
| List S3 buckets | `aws s3 ls` |
| Check bucket versioning | `aws s3api get-bucket-versioning --bucket wuxia-mud-terraform-state` |
| List OIDC providers | `aws iam list-open-id-connect-providers` |
| Get OIDC provider details | `aws iam get-open-id-connect-provider --open-id-connect-provider-arn <ARN>` |
| List GitHub secrets | `gh secret list --repo yongouyang/mud_game` |
| Check ACM certificates | `aws acm list-certificates --region ap-southeast-1` |
| Check certificate status | `aws acm describe-certificate --certificate-arn <ARN>` |

---

## Next Steps

Once all manual steps are complete, proceed to **Step 10 (Terraform)** in `IMPLEMENTATION_STEPS.md`:

```bash
cd terraform
terraform init
terraform plan
terraform apply
```
