import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import type { Command } from '@types';
import { describeCommand } from '@bot/describer/command-describer';
import { setVoiceLogChannel, getVoiceLogChannel } from '@bot/database';

const description = describeCommand(
 'voice-channel-log',
 'Set the channel for voice channel join/leave logs'
);

export const voiceChannelLogCommand: Command = {
 description,
 data: new SlashCommandBuilder()
   .setName(description.name)
   .setDescription(description.description)
   .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
   .addChannelOption(option =>
     option
       .setName('channel')
       .setDescription('The channel to send voice logs to')
       .setRequired(true)
       .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
   ),

 async execute(interaction) {
   if (!interaction.guild) {
     await interaction.reply({
       content: '❌ This command can only be used in a server.',
       flags: MessageFlags.Ephemeral
     });
     return;
   }

   const channel = interaction.options.getChannel('channel', true);

   await setVoiceLogChannel(interaction.guildId!, channel.id);

   await interaction.reply({
     content: `✅ Voice channel logs will be sent to <#${channel.id}>`,
     flags: MessageFlags.Ephemeral
   });
 }
};