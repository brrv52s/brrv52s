const { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// المعرفات الثابتة
const TICKET_LOG_CHANNEL_ID = 'ID_قناة_التسجيلات'; // استبدل بمعرف قناة إشعارات التذاكر
const ADMIN_ROLE_ID = 'ID_رتبة_المشرفين'; // استبدل بمعرف رتبة المشرفين

// التحقق من وجود ملف التذاكر وإنشاؤه إذا لم يكن موجودًا
const ticketsFilePath = './tickets.json';
if (!fs.existsSync(ticketsFilePath)) {
  fs.writeFileSync(ticketsFilePath, JSON.stringify({}, null, 2)); // إنشاء الملف فارغًا إذا لم يكن موجودًا
}

// تحميل بيانات التذاكر
const ticketsData = JSON.parse(fs.readFileSync(ticketsFilePath, 'utf8') || '{}');

// حفظ بيانات التذاكر
function saveTicketsData() {
  fs.writeFileSync(ticketsFilePath, JSON.stringify(ticketsData, null, 2));
}

client.once('ready', () => {
  console.log(`تم تسجيل الدخول كبوت: ${client.user.tag}`);
});

// إنشاء قائمة اختيار نوع التذكرة
client.on('messageCreate', async (message) => {
  if (message.content === '!setupTicket') {
    const ticketMenu = new StringSelectMenuBuilder()
      .setCustomId('selectTicketType')
      .setPlaceholder('اختر نوع التذكرة')
      .addOptions([
        { label: 'دعم فني', description: 'للمساعدة في الدعم الفني', value: 'support' },
        { label: 'استفسار عام', description: 'لأي استفسار عام', value: 'general' },
        { label: 'شكوى', description: 'لتقديم شكوى', value: 'complaint' },
      ]);

    const row = new ActionRowBuilder().addComponents(ticketMenu);

    await message.channel.send({
      content: 'يرجى اختيار نوع التذكرة من القائمة أدناه.',
      components: [row],
    });
  }
});

// التعامل مع قائمة اختيار نوع التذكرة
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isSelectMenu()) return;

  if (interaction.customId === 'selectTicketType') {
    const ticketType = interaction.values[0];
    const ticketTypes = {
      support: 'دعم فني',
      general: 'استفسار عام',
      complaint: 'شكوى',
    };

    const existingChannel = interaction.guild.channels.cache.find(
      (channel) => channel.name === `ticket-${interaction.user.id}`
    );
    if (existingChannel) {
      return interaction.reply({
        content: 'لديك تذكرة مفتوحة بالفعل!',
        ephemeral: true,
      });
    }

    const ticketChannel = await interaction.guild.channels.create(
      `ticket-${interaction.user.id}`,
      {
        type: 0, // نوع القناة النصية
        topic: `تذكرة ${ticketTypes[ticketType]} لـ ${interaction.user.tag}`,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
          },
          {
            id: ADMIN_ROLE_ID,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
          },
        ],
      }
    );

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('closeTicket')
        .setLabel('إغلاق التذكرة')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('assignAdmin')
        .setLabel('تعيين مشرف')
        .setStyle(ButtonStyle.Secondary)
    );

    ticketsData[interaction.user.id] = {
      type: ticketType,
      createdAt: new Date(),
      status: 'open',
      channelId: ticketChannel.id,
    };
    saveTicketsData();

    await ticketChannel.send({
      content: `مرحبًا ${interaction.user}! لقد أنشأت تذكرة ${ticketTypes[ticketType]}. سيتم مساعدتك قريبًا.`,
      components: [closeRow],
    });

    const logChannel = interaction.guild.channels.cache.get(TICKET_LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`تم إنشاء تذكرة جديدة من ${interaction.user.tag} لنوع: ${ticketTypes[ticketType]}.`);
    }

    interaction.reply({ content: 'تم إنشاء تذكرتك!', ephemeral: true });
  }
});

// التعامل مع الأزرار
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'closeTicket') {
    if (
      !interaction.channel.name.startsWith('ticket-') ||
      (interaction.channel.name !== `ticket-${interaction.user.id}` &&
        !interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels))
    ) {
      return interaction.reply({
        content: 'ليس لديك الصلاحيات لإغلاق هذه التذكرة.',
        ephemeral: true,
      });
    }

    await interaction.reply('سيتم إغلاق التذكرة خلال 5 ثوانٍ...');
    setTimeout(async () => {
      ticketsData[interaction.user.id].status = 'closed';
      saveTicketsData();

      const feedbackRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('giveFeedback')
          .setLabel('تقييم الخدمة')
          .setStyle(ButtonStyle.Primary)
      );
      interaction.channel.send(
        'شكراً لك على استخدامك خدماتنا. نود أن نعرف رأيك!',
        { components: [feedbackRow] }
      );

      await interaction.channel.delete().catch((err) => console.error('تعذر حذف القناة:', err));
    }, 5000);
  }

  if (interaction.customId === 'assignAdmin') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.reply({
        content: 'ليس لديك الصلاحيات لتعيين مشرف لهذه التذكرة.',
        ephemeral: true,
      });
    }

    ticketsData[interaction.channel.name.split('-')[1]].assignedTo = interaction.user.id;
    saveTicketsData();
    interaction.reply({
      content: `${interaction.user} تم تعيينك كالمشرف المسؤول عن هذه التذكرة.`,
    });
  }

  if (interaction.customId === 'giveFeedback') {
    interaction.reply('شكرًا لك على تقييمك! نسعد بخدمتك.');
  }
});

client.login(process.env.TOKEN);
