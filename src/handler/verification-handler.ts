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
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type Client,
  type GuildMember
} from 'discord.js';
import { 
  getVerificationConfig, 
  isVerified, 
  verifyUser 
} from '@bot/database/verification-database';

const activeMath = new Map<string, { num1: number; num2: number; answer: number }>();

function generateMathProblem(): { num1: number; num2: number; answer: number } {
  const num1 = Math.floor(Math.random() * 20) + 1;
  const num2 = Math.floor(Math.random() * 20) + 1;
  return { num1, num2, answer: num1 + num2 };
}

export class VerificationHandler {
  constructor(client: Client) {
    this.setupListeners(client);
  }

  private setupListeners(client: Client): void {
    client.on(Events.InteractionCreate, async (interaction) => {
      console.log(`[Verification] Interaction received: ${interaction.id}, type: ${interaction.isButton() ? 'button' : interaction.isModalSubmit() ? 'modal' : 'other'}, customId: ${(interaction as any).customId || 'none'}`);
      
      if (!interaction.isButton() && !interaction.isModalSubmit()) {
        console.log(`[Verification] Ignoring non-button/modal interaction`);
        return;
      }
      if (!interaction.guildId) {
        console.log(`[Verification] No guildId, ignoring`);
        return;
      }
      
      console.log(`[Verification] Processing for guild: ${interaction.guildId}`);
      
      try {
        const config = await getVerificationConfig(interaction.guildId);
        console.log(`[Verification] Config retrieved:`, config);
        
        if (!config) {
          console.log(`[Verification] No config found for guild ${interaction.guildId}`);
          return;
        }
        if (!config.role_id) {
          console.log(`[Verification] No role_id in config`);
          return;
        }

        if (interaction.isButton()) {
          console.log(`[Verification] Button clicked: ${interaction.customId}`);
          if (interaction.customId === 'verify_simple') {
            await this.handleSimpleVerification(interaction, config);
          } else if (interaction.customId === 'verify_custom') {
            await this.handleMathPrompt(interaction);
          }
        } else if (interaction.isModalSubmit() && interaction.customId === 'submit_math') {
          console.log(`[Verification] Modal submitted`);
          await this.handleMathSubmit(interaction, config);
        }
      } catch (error) {
        console.error(`[Verification] CRITICAL ERROR in interaction handler:`, error);
        try {
          if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ An error occurred. Please try again.',
              ephemeral: true
            });
          }
        } catch (e) {
          console.error(`[Verification] Failed to send error response:`, e);
        }
      }
    });

    client.on(Events.GuildMemberAdd, async (member) => {
      console.log(`[Verification] Member joined: ${member.id} in guild ${member.guild.id}`);
      try {
        const config = await getVerificationConfig(member.guild.id);
        console.log(`[Verification] Config for auto-role:`, config);
        
        if (!config || !config.role_id) {
          console.log(`[Verification] No auto-verification config`);
          return;
        }

        const alreadyVerified = await isVerified(member.id, member.guild.id);
        console.log(`[Verification] User ${member.id} already verified: ${alreadyVerified}`);
        
        if (alreadyVerified) {
          await member.roles.add(config.role_id).catch((err) => {
            console.error(`[Verification] Failed to add primary role on join:`, err);
          });
          if (config.secondary_role_id) {
            await member.roles.add(config.secondary_role_id).catch((err) => {
              console.error(`[Verification] Failed to add secondary role on join:`, err);
            });
          }
          console.log(`[Verification] Roles added to returning user`);
        }
      } catch (error) {
        console.error(`[Verification] Error in GuildMemberAdd:`, error);
      }
    });
  }

  private async handleSimpleVerification(interaction: ButtonInteraction, config: any): Promise<void> {
    console.log(`[Verification] handleSimpleVerification started for user ${interaction.user.id}`);
    
    const member = interaction.member as GuildMember;
    
    if (!member) {
      console.log(`[Verification] Member object is null`);
      await interaction.reply({
        content: '❌ Could not find your member data',
        ephemeral: true
      });
      return;
    }
    console.log(`[Verification] Member found: ${member.id}`);

    const alreadyVerified = await isVerified(member.id, interaction.guildId!);
    console.log(`[Verification] Already verified check: ${alreadyVerified}`);
    
    if (alreadyVerified) {
      await interaction.reply({
        content: '✅ You are already verified!',
        ephemeral: true
      });
      return;
    }

    try {
      console.log(`[Verification] Adding primary role: ${config.role_id}`);
      await member.roles.add(config.role_id);
      console.log(`[Verification] Primary role added successfully`);
      
      if (config.secondary_role_id) {
        console.log(`[Verification] Adding secondary role: ${config.secondary_role_id}`);
        await member.roles.add(config.secondary_role_id);
        console.log(`[Verification] Secondary role added successfully`);
      }
      
      console.log(`[Verification] Recording verification in database`);
      await verifyUser(member.id, interaction.guildId!);
      console.log(`[Verification] Database updated`);
      
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Verified')
        .setDescription('You have been verified and granted access!');

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
      console.log(`[Verification] Success response sent`);
    } catch (error) {
      console.error(`[Verification] FAILED to complete verification:`, error);
      await interaction.reply({
        content: '❌ Failed to verify. Please contact an admin.',
        ephemeral: true
      });
    }
  }

  private async handleMathPrompt(interaction: ButtonInteraction): Promise<void> {
    console.log(`[Verification] handleMathPrompt started for user ${interaction.user.id}`);
    
    const math = generateMathProblem();
    activeMath.set(interaction.user.id, math);
    console.log(`[Verification] Math problem generated: ${math.num1} + ${math.num2} = ${math.answer}`);
    
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

    try {
      await interaction.showModal(modal);
      console.log(`[Verification] Modal shown successfully`);
    } catch (error) {
      console.error(`[Verification] Failed to show modal:`, error);
      throw error;
    }
  }

  private async handleMathSubmit(interaction: ModalSubmitInteraction, config: any): Promise<void> {
    console.log(`[Verification] handleMathSubmit started for user ${interaction.user.id}`);
    
    await interaction.deferReply({ ephemeral: true });
    console.log(`[Verification] Reply deferred`);

    const userAnswer = parseInt(interaction.fields.getTextInputValue('math_answer'));
    const mathData = activeMath.get(interaction.user.id);
    console.log(`[Verification] User answer: ${userAnswer}, expected: ${mathData?.answer}`);

    if (!mathData) {
      console.log(`[Verification] No active math session found`);
      await interaction.editReply({
        content: '❌ Verification expired. Please start again.'
      });
      return;
    }

    if (isNaN(userAnswer) || userAnswer !== mathData.answer) {
      activeMath.delete(interaction.user.id);
      console.log(`[Verification] Wrong answer provided`);
      
      await interaction.editReply({
        content: `❌ Wrong answer. The correct answer was **${mathData.answer}**. Click the button to try again.`
      });
      return;
    }

    activeMath.delete(interaction.user.id);
    console.log(`[Verification] Correct answer, proceeding with verification`);
    
    const member = interaction.member as GuildMember;
    
    if (!member) {
      console.log(`[Verification] Member object is null in modal submit`);
      await interaction.editReply({
        content: '❌ Could not find your member data'
      });
      return;
    }

    try {
      console.log(`[Verification] Adding primary role: ${config.role_id}`);
      await member.roles.add(config.role_id);
      console.log(`[Verification] Primary role added`);
      
      if (config.secondary_role_id) {
        console.log(`[Verification] Adding secondary role: ${config.secondary_role_id}`);
        await member.roles.add(config.secondary_role_id);
        console.log(`[Verification] Secondary role added`);
      }
      
      console.log(`[Verification] Recording verification in database`);
      await verifyUser(member.id, interaction.guildId!);
      console.log(`[Verification] Database updated`);
      
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Verified')
        .setDescription('Correct! You have been granted access.');

      await interaction.editReply({ embeds: [embed] });
      console.log(`[Verification] Success response sent`);
    } catch (error) {
      console.error(`[Verification] FAILED to complete verification:`, error);
      await interaction.editReply({
        content: '❌ Failed to assign role. Please contact an admin.'
      });
    }
  }
}