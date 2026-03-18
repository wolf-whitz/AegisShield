import { Events, MessageFlags, type Client, type ButtonInteraction } from 'discord.js';
import { addParticipant, getGiveaway } from '@bot/database';
import { logError } from '@utils';

export class GiveawayButtonHandler {
  constructor(client: Client) {
    this.setupListeners(client);
  }

  private setupListeners(client: Client): void {
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton()) return;
      await this.handleButton(interaction);
    });
  }

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    if (interaction.customId !== 'giveaway_enter') return;
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This button can only be used in a server.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      const giveaway = await getGiveaway(interaction.message.id);
      if (!giveaway) {
        await interaction.reply({
          content: '❌ Giveaway not found.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (giveaway.guild_id !== interaction.guildId) {
        await interaction.reply({
          content: '❌ This giveaway is not in this server.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (giveaway.ended) {
        await interaction.reply({
          content: '❌ This giveaway has already ended.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (giveaway.participants?.includes(interaction.user.id)) {
        await interaction.reply({
          content: '❌ You are already entered in this giveaway!',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await addParticipant(interaction.message.id, interaction.user.id);
      await interaction.reply({
        content: '✅ You have entered the giveaway! Good luck!',
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      logError('giveawayButton_enterFailed', { 
        messageId: interaction.message.id, 
        userId: interaction.user.id, 
        error 
      });
      await interaction.reply({
        content: '❌ Failed to enter giveaway. Try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
}