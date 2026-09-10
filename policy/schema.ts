export interface ApprovalPolicy {
  required_if_risk_at_least: number;
  required_if_database_migration: boolean;
  required_if_security_change: boolean;
}

export interface DeploymentPolicy {
  require_healthy_canary: boolean;
}

export interface ProductionPolicy {
  max_changed_files: number;
  required_checks: string[];
  forbidden_paths: string[];
  approval: ApprovalPolicy;
  deployment: DeploymentPolicy;
}

export interface PolicyDocument {
  policies: {
    production: ProductionPolicy;
  };
}
