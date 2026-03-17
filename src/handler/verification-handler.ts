import { 
  Events, 
  EmbedBuilder, 
  Colors, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type Client,
  type GuildMember
} from 'discord.js';
import { getVerificationConfig } from '@bot/database/verification-database';

const activeMath = new Map<string, { num1: number; num2: number; answer: number }>();

function generateMathProblem(): { num1: number; num2: number; answer: number } {
  const num1 = Math.floor(Math.random() * 20) + 1;
  const num2 = Math.floor(Math.random() * 20) + 1;
  return { num1, num2, answer: num1 + num2 };
}

function isUserVerified(member: GuildMember, config: any): boolean {
  return member.roles.cache.has(config.role_id);
}

export class VerificationHandler {
  constructor(client: Client) {
    this.setupListeners(client);
  }

  private setupListeners(client: Client): void {
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton() && !interaction.isModalSubmit()) return;
      if (!interaction.guildId) return;
      
      try {
        const config = await getVerificationConfig(interaction.guildId);
        if (!config || !config.role_id) return;

        if (interaction.isButton()) {
          if (interaction.customId === 'verify_simple') {
            await this.handleSimpleVerification(interaction, config);
          } else if (interaction.customId === 'verify_custom') {
            await this.handleMathPrompt(interaction);
          }
        } else if (interaction.isModalSubmit() && interaction.customId === 'submit_math') {
          await this.handleMathSubmit(interaction, config);
        }
      } catch (error) {
        console.error(`[Verification] Error:`, error);
        try {
          if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ An error occurred. Please try again.',
              flags: MessageFlags.Ephemeral
            });
          }
        } catch (e) {
          console.error(`[Verification] Failed to send error response:`, e);
        }
      }
    });
  }

  private async handleSimpleVerification(interaction: ButtonInteraction, config: any): Promise<void> {
    const member = interaction.member as GuildMember;
    
    if (!member) {
      await interaction.reply({
        content: '❌ Could not find your member data',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (isUserVerified(member, config)) {
      await interaction.reply({
        content: '✅ You are already verified!',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    try {
      await member.roles.add(config.role_id);
      
      if (config.secondary_role_id) {
        await member.roles.add(config.secondary_role_id);
      }
      
      if (config.remove_role_id && member.roles.cache.has(config.remove_role_id)) {
        await member.roles.remove(config.remove_role_id);
      }
      
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Verified')
        .setDescription('You have been verified and granted access!');

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      });
    } catch (error: any) {
      console.error(`[Verification] Failed to verify:`, error);
      
      let errorMessage = '❌ Failed to verify. ';
      if (error.code === 50013) {
        errorMessage += 'I need my role to be ABOVE the verification roles in Server Settings > Roles!';
      } else {
        errorMessage += 'Please contact an admin.';
      }
      
      await interaction.reply({
        content: errorMessage,
        flags: MessageFlags.Ephemeral
      });
    }
  }

  private async handleMathPrompt(interaction: ButtonInteraction): Promise<void> {
    const math = generateMathProblem();
    activeMath.set(interaction.user.id, math);
    
    const modal = new ModalBuilder()
      .setCustomId('submit_math')
      .setTitle('Math Verification');

    const answerInput = new TextInputBuilder()
      .setCustomId('math_answer')
      .setLabel(`What is ${math.num1} + ${math.num2}?`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter the answer')
      .setMaxLength(3)
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(answerInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }

  private async handleMathSubmit(interaction: ModalSubmitInteraction, config: any): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userAnswer = parseInt(interaction.fields.getTextInputValue('math_answer'));
    const mathData = activeMath.get(interaction.user.id);

    if (!mathData) {
      await interaction.editReply({
        content: '❌ Verification expired. Please start again.'
      });
      return;
    }

    if (isNaN(userAnswer) || userAnswer !== mathData.answer) {
      activeMath.delete(interaction.user.id);
      
      await interaction.editReply({
        content: `❌ Wrong answer. The correct answer was **${mathData.answer}**. Click the button to try again.`
      });
      return;
    }

    activeMath.delete(interaction.user.id);
    
    const member = interaction.member as GuildMember;
    
    if (!member) {
      await interaction.editReply({
        content: '❌ Could not find your member data'
      });
      return;
    }

    try {
      await member.roles.add(config.role_id);
      
      if (config.secondary_role_id) {
        await member.roles.add(config.secondary_role_id);
      }
      
      if (config.remove_role_id && member.roles.cache.has(config.remove_role_id)) {
        await member.roles.remove(config.remove_role_id);
      }
      
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Verified')
        .setDescription('Correct! You have been granted access.');

      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      console.error(`[Verification] Failed to verify:`, error);
      
      let errorMessage = '❌ Failed to assign role. ';
      if (error.code === 50013) {
        errorMessage += 'I need my role to be ABOVE the verification roles in Server Settings > Roles!';
      } else {
        errorMessage += 'Please contact an admin.';
      }
      
      await interaction.editReply({ content: errorMessage });
    }
  }
}