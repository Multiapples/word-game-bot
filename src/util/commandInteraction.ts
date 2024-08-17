import { CommandInteraction, InteractionReplyOptions, InteractionResponse, Message } from "discord.js";

export async function autoReply(interaction: CommandInteraction, options: InteractionReplyOptions): Promise<Message<boolean> | InteractionResponse<boolean>> {
    if (interaction.replied || interaction.deferred) {
        return interaction.followUp(options);
    } else {
        return interaction.reply(options);
    }
}