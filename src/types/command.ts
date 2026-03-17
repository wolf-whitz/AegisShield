import type { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, PermissionResolvable } from 'discord.js';

export interface CommandDescription {
  name: string;
  description: string;
}

export interface Command {
  description: CommandDescription;
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}