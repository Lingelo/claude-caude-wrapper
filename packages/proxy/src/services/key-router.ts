import type { RoleKeysMapping } from "../types.js";

export class KeyRouter {
  constructor(private readonly mapping: RoleKeysMapping) {}

  getApiKey(role: string): string {
    const entry = this.mapping.role_keys[role];
    if (entry) {
      return entry.api_key;
    }
    return this.mapping.role_keys["default"].api_key;
  }

  hasRole(role: string): boolean {
    return role in this.mapping.role_keys;
  }

  getRoles(): string[] {
    return Object.keys(this.mapping.role_keys);
  }
}
