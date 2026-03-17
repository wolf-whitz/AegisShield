import type { CommandDescription } from '@types';

export function describeCommand(
  name: string,
  description: string
): CommandDescription {
  return {
    name,
    description,
  };
}