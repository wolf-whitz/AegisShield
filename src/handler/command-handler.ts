import { Collection, REST, Routes } from 'discord.js';
import type { Command } from '../types/command.js';
import { pingCommand } from '../commands/ping.js';
import { 
  honeypotChannelCommand, 
  honeypotCreateCommand,
  spamshieldCommand,
  linkshieldCommand,
  embedshieldCommand,
  reactshieldCommand,
  voiceshieldCommand,
  threadshieldCommand,
  appshieldCommand,
  pollshieldCommand,
  unlockCommand,
  allowLinkCommand,
  allowLinkListCommand,
} from '@commands';
import { roleCreateCommand, roleCreatePresetCommand } from '@commands';
import { ticketSetupCommand, purgeCommand, verificationChannelCommand, serverStatsCommand, generateCatCommand, generateDogCommand, userCommand, modifyPingMessageCommand, aiModerationCommand } from '@commands';

export class CommandHandler {
  public commands = new Collection<string, Command>();
  private rest: REST;

  constructor(token: string) {
    this.rest = new REST({ version: '10' }).setToken(token);
    this.loadCommands();
  }

  private loadCommands(): void {
    this.commands.set(pingCommand.description.name, pingCommand);
    this.commands.set(honeypotChannelCommand.description.name, honeypotChannelCommand);
    this.commands.set(honeypotCreateCommand.description.name, honeypotCreateCommand);
    this.commands.set(spamshieldCommand.description.name, spamshieldCommand);
    this.commands.set(linkshieldCommand.description.name, linkshieldCommand);
    this.commands.set(embedshieldCommand.description.name, embedshieldCommand);
    this.commands.set(reactshieldCommand.description.name, reactshieldCommand);
    this.commands.set(voiceshieldCommand.description.name, voiceshieldCommand);
    this.commands.set(threadshieldCommand.description.name, threadshieldCommand);
    this.commands.set(appshieldCommand.description.name, appshieldCommand);
    this.commands.set(pollshieldCommand.description.name, pollshieldCommand);
    this.commands.set(unlockCommand.description.name, unlockCommand);
    this.commands.set(allowLinkCommand.description.name, allowLinkCommand);
    this.commands.set(allowLinkListCommand.description.name, allowLinkListCommand);
    this.commands.set(roleCreateCommand.description.name, roleCreateCommand);
    this.commands.set(roleCreatePresetCommand.description.name, roleCreatePresetCommand);
    this.commands.set(ticketSetupCommand.description.name, ticketSetupCommand);
    this.commands.set(verificationChannelCommand.description.name, verificationChannelCommand);
    this.commands.set(serverStatsCommand.description.name, serverStatsCommand);
    this.commands.set(generateCatCommand.description.name, generateCatCommand);
    this.commands.set(generateDogCommand.description.name, generateDogCommand);
    this.commands.set(userCommand.description.name, userCommand);
    this.commands.set(modifyPingMessageCommand.description.name, modifyPingMessageCommand);
    this.commands.set(aiModerationCommand.description.name, aiModerationCommand);
    this.commands.set(purgeCommand.description.name, purgeCommand);
  }

  async registerCommands(clientId: string): Promise<void> {
    const commandsData = this.commands.map(cmd => cmd.data.toJSON());

    try {
      await this.rest.put(
        Routes.applicationCommands(clientId),
        { body: commandsData }
      );
      console.log(`Registered ${commandsData.length} commands`);
    } catch (error) {
      console.error('Failed to register commands:', error);
      throw error;
    }
  }

  getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }
}