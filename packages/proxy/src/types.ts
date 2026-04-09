export interface RoleKeyConfig {
  api_key: string;
  description: string;
}

export interface RoleKeysMapping {
  role_keys: Record<string, RoleKeyConfig>;
}

export interface UserContext {
  sub: string;
  email: string;
  role: string;
}

export interface UsageRecord {
  user_sub: string;
  user_email: string;
  user_role: string;
  session_id: string | null;
  endpoint: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  request_duration_ms: number;
  status_code: number;
  error_message: string | null;
}

export interface StreamUsageResult {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}
