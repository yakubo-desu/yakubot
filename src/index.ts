import { config } from 'dotenv'; config();
import { Client, Intents, MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';

const readFromEnv = (envVar: string) => {
    const val = process.env[envVar];
    if (val == null) throw new Error(`${envVar} is missing from environment`);
    return val;
}

const CONSTANTS = {
    guildID: readFromEnv('GUILD_ID'),
    channelID: readFromEnv('CHANNEL_ID'),
    messageID: readFromEnv('MESSAGE_ID'),
    reactionToRoleIDMap: {
        [readFromEnv('REACTION_ID')]: readFromEnv('ROLE_ID')
    } as Record<string, string>
}

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILD_MEMBERS
    ],
	partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'USER'],
});

client.once('ready', async (client) => {
    console.log(`Logged in as ${client.user?.tag}!`);
    try {
        await loadMessage(client, CONSTANTS);
    } catch (error) {
        console.error('Something went wrong when caching the message:', error);
        return;
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
	try {
        await toggleRoleFromReaction(reaction, user);
    } catch (error) {
        console.error('Error while processing reaction add:', error);
        return;
    }
});

async function loadMessage(
    client: Client<true>,
    opts: {guildID: string, channelID: string, messageID: string}
): Promise<boolean> {
    await client.guilds.fetch();
    const guild = await client.guilds.cache.get(opts.guildID)?.fetch();
    if (!guild) return false;
    const channel = await guild?.channels.cache.get(opts.channelID)?.fetch();
    if (!channel?.isText()) return false;
    await channel.messages.fetch(opts.messageID);
    return true;
}

// Currently, it always tries to add, not remove (cuz RLI bot causes race conditions)
async function toggleRoleFromReaction(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
) {
    const roleID = CONSTANTS.reactionToRoleIDMap[reaction.emoji.id!];
    if (!roleID) return;

    await reaction.fetch();
	if (reaction.partial) throw new Error('reaction still partial after fetch');

    await reaction.message.fetch();
    const guild = await reaction.message.guild;
    if (!guild) throw new Error("guild not found");

    const role = guild.roles.cache.get(roleID);
    if (!role) throw new Error("role not found");

    await guild.members.fetch();
    const member = guild.members.cache.get(user.id);
    if (!member) throw new Error('member not found with id: ' + user.id);

    // if (member.roles.cache.has(roleID)) {
        // await member.roles.remove(role);
        // console.log(`Removed ${role.name} role for user ${member.displayName}`);
    // }
    // else {
        await member.roles.add(role);
        console.log(`Added ${role.name} role for user ${member.displayName}`);
    // }
}

client.login(process.env.DISCORD_TOKEN);

