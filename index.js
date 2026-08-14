// index.js – Telegram Bot trên Vercel (Webhook)
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

if (!BOT_TOKEN || !MONGO_URI) {
  console.error('❌ Thiếu biến môi trường!');
}

let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  const conn = await mongoose.connect(MONGO_URI);
  cachedDb = conn;
  console.log('✅ Kết nối MongoDB thành công!');
  return conn;
}

// ============ SCHEMA ============
const UserSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  username: String,
  balance: { type: Number, default: 0 },
  role: { type: String, default: 'user' },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  stock: { type: Number, default: 1 },
  type: { type: String, default: 'account' },
  accUsername: String,
  accPassword: String,
  fileLink: String,
  createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', ProductSchema);

const OrderSchema = new mongoose.Schema({
  userId: String,
  productId: String,
  productName: String,
  price: Number,
  status: { type: String, default: 'completed' },
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);

// ============ KHỞI TẠO BOT ============
const bot = new Telegraf(BOT_TOKEN);

bot.use(async (ctx, next) => {
  if (!ctx.from) return next();
  await connectToDatabase();
  const userId = String(ctx.from.id);
  let user = await User.findOne({ userId });
  if (!user) {
    user = new User({
      userId,
      username: ctx.from.username || ctx.from.first_name
    });
    await user.save();
    console.log(`👤 User mới: ${userId}`);
  }
  ctx.user = user;
  next();
});

bot.start(async (ctx) => {
  await ctx.replyWithHTML(
    `🤖 <b>Chào mừng đến Shop Thành Duy!</b>\n\n` +
    `/shop – Xem sản phẩm\n` +
    `/balance – Số dư\n` +
    `/history – Lịch sử\n` +
    `/recharge – Nạp tiền\n` +
    `/admin – Quản lý (Admin)`
  );
});

bot.command('shop', async (ctx) => {
  await connectToDatabase();
  const products = await Product.find({ stock: { $gt: 0 } });
  if (!products.length) return ctx.reply('🛒 Chưa có sản phẩm.');
  let msg = '🛒 <b>SẢN PHẨM</b>\n\n';
  products.forEach((p, i) => {
    msg += `${i+1}. <b>${p.name}</b> – ${p.price.toLocaleString()}đ\n`;
    msg += `   📦 Còn: ${p.stock}\n`;
    msg += `   ➡️ <code>/buy ${p._id}</code>\n\n`;
  });
  await ctx.replyWithHTML(msg);
});

bot.command('buy', async (ctx) => {
  await connectToDatabase();
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('❌ Dùng: <code>/buy [id]</code>');
  const product = await Product.findById(args[1]);
  if (!product) return ctx.reply('❌ Sản phẩm không tồn tại!');
  if (product.stock <= 0) return ctx.reply('❌ Hết hàng!');
  const user = ctx.user;
  if (user.balance < product.price) {
    return ctx.replyWithHTML(
      `❌ Số dư không đủ!\n💰 Bạn có: ${user.balance.toLocaleString()}đ\n💳 Cần thêm: ${(product.price - user.balance).toLocaleString()}đ`
    );
  }
  user.balance -= product.price;
  await user.save();
  product.stock -= 1;
  await product.save();
  const order = new Order({
    userId: user.userId,
    productId: product._id,
    productName: product.name,
    price: product.price
  });
  await order.save();
  let msg = `✅ Mua thành công!\n📦 ${product.name}\n💰 ${product.price.toLocaleString()}đ\n`;
  if (product.type === 'account') {
    msg += `👤 ${product.accUsername}\n🔑 ${product.accPassword}`;
  } else if (product.type === 'file') {
    msg += `📥 ${product.fileLink}`;
  }
  await ctx.reply(msg);
});

bot.command('balance', async (ctx) => {
  await ctx.replyWithHTML(`💰 <b>Số dư:</b> ${ctx.user.balance.toLocaleString()}đ`);
});

bot.command('history', async (ctx) => {
  await connectToDatabase();
  const orders = await Order.find({ userId: ctx.user.userId }).sort({ createdAt: -1 }).limit(10);
  if (!orders.length) return ctx.reply('📭 Chưa có đơn hàng.');
  let msg = '📋 <b>Lịch sử</b>\n\n';
  orders.forEach((o, i) => {
    msg += `${i+1}. ${o.productName} – ${o.price.toLocaleString()}đ\n`;
    msg += `   🕐 ${o.createdAt.toLocaleString('vi-VN')}\n\n`;
  });
  await ctx.replyWithHTML(msg);
});

bot.command('recharge', async (ctx) => {
  await ctx.replyWithHTML(
    `💳 <b>NẠP TIỀN</b>\n\n` +
    `1️⃣ Chuyển khoản: MB Bank – LÊ CÔNG THÀNH DUY – 0972864913\n` +
    `2️⃣ Nội dung: <code>NAP ${ctx.user.userId}</code>\n` +
    `3️⃣ Gửi ảnh biên lai cho Admin.`
  );
});

bot.command('admin', async (ctx) => {
  if (ctx.user.role !== 'admin') return ctx.reply('⛔ Không có quyền!');
  await ctx.replyWithHTML(
    `🔑 <b>ADMIN PANEL</b>\n\n` +
    `➕ <code>/addproduct "Tên" giá loại user pass</code>\n` +
    `➖ <code>/delproduct [id]</code>\n` +
    `💰 <code>/addbalance [userId] [số tiền]</code>\n` +
    `📊 <code>/stats</code>`
  );
});

bot.command('addproduct', async (ctx) => {
  if (ctx.user.role !== 'admin') return ctx.reply('⛔ Không có quyền!');
  await connectToDatabase();
  const text = ctx.message.text;
  const first = text.indexOf('"');
  const second = text.indexOf('"', first+1);
  if (first === -1 || second === -1) {
    return ctx.reply('❌ Dùng: <code>/addproduct "Tên" giá loại user pass</code>');
  }
  const name = text.substring(first+1, second);
  const parts = text.substring(second+1).trim().split(' ');
  if (parts.length < 2) return ctx.reply('❌ Thiếu thông tin!');
  const price = parseInt(parts[0]);
  if (!price) return ctx.reply('❌ Giá không hợp lệ!');
  const type = parts[1];
  let accUser='', accPass='', fileLink='';
  if (type === 'account') {
    accUser = parts[2] || '';
    accPass = parts[3] || '';
    if (!accUser || !accPass) return ctx.reply('❌ Cần username và password!');
  } else if (type === 'file') {
    fileLink = parts[2] || '';
    if (!fileLink) return ctx.reply('❌ Cần link file!');
  } else {
    return ctx.reply('❌ Loại sản phẩm phải là "account" hoặc "file"');
  }
  const product = new Product({ name, price, stock: 1, type, accUsername: accUser, accPassword: accPass, fileLink });
  await product.save();
  await ctx.replyWithHTML(`✅ Đã thêm:\n📦 ${name}\n💰 ${price.toLocaleString()}đ\n🆔 <code>${product._id}</code>`);
});

bot.command('delproduct', async (ctx) => {
  if (ctx.user.role !== 'admin') return ctx.reply('⛔ Không có quyền!');
  await connectToDatabase();
  const id = ctx.message.text.split(' ')[1];
  if (!id) return ctx.reply('❌ Dùng: /delproduct [id]');
  const result = await Product.findByIdAndDelete(id);
  await ctx.reply(result ? `✅ Đã xóa ${result.name}` : '❌ Không tìm thấy');
});

bot.command('addbalance', async (ctx) => {
  if (ctx.user.role !== 'admin') return ctx.reply('⛔ Không có quyền!');
  await connectToDatabase();
  const args = ctx.message.text.split(' ');
  if (args.length < 3) return ctx.reply('❌ Dùng: /addbalance [userId] [số tiền]');
  const userId = args[1];
  const amount = parseInt(args[2]);
  if (!amount || amount <= 0) return ctx.reply('❌ Số tiền không hợp lệ!');
  const user = await User.findOne({ userId });
  if (!user) return ctx.reply('❌ Không tìm thấy user!');
  user.balance += amount;
  await user.save();
  await ctx.replyWithHTML(`✅ Đã cộng <b>${amount.toLocaleString()}đ</b> cho ${user.username}`);
});

bot.command('stats', async (ctx) => {
  if (ctx.user.role !== 'admin') return ctx.reply('⛔ Không có quyền!');
  await connectToDatabase();
  const totalUsers = await User.countDocuments();
  const totalOrders = await Order.countDocuments();
  const totalProducts = await Product.countDocuments();
  const revenue = await Order.aggregate([{ $group: { _id: null, total: { $sum: '$price' } } }]);
  await ctx.replyWithHTML(
    `📊 <b>THỐNG KÊ</b>\n\n` +
    `👤 Số user: ${totalUsers}\n` +
    `📦 Số sản phẩm: ${totalProducts}\n` +
    `📋 Số đơn hàng: ${totalOrders}\n` +
    `💰 Doanh thu: ${(revenue[0]?.total || 0).toLocaleString()}đ`
  );
});

module.exports = async (req, res) => {
  try {
    await bot.handleUpdate(req.body, res);
  } catch (err) {
    console.error('❌ Lỗi webhook:', err);
    res.status(500).send('Error');
  }
};
