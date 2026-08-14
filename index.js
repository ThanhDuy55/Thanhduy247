// api/index.js – Telegram Bot trên Vercel
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');

// ============ BIẾN MÔI TRƯỜNG ============
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

if (!BOT_TOKEN || !MONGO_URI) {
  console.error('❌ Thiếu biến môi trường!');
}

// ============ KẾT NỐI MONGODB ============
let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  try {
    const conn = await mongoose.connect(MONGO_URI);
    cachedDb = conn;
    console.log('✅ Kết nối MongoDB thành công!');
    return conn;
  } catch (err) {
    console.error('❌ Lỗi kết nối MongoDB:', err);
    throw err;
  }
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

// Middleware lưu user
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();
  try {
    await connectToDatabase();
    const userId = String(ctx.from.id);
    let user = await User.findOne({ userId });
    if (!user) {
      user = new User({
        userId,
        username: ctx.from.username || ctx.from.first_name
      });
      await user.save();
      console.log(`👤 User mới: ${userId} (${user.username})`);
    }
    ctx.user = user;
    next();
  } catch (err) {
    console.error('❌ Lỗi middleware:', err);
    ctx.reply('⚠️ Đã có lỗi xảy ra, vui lòng thử lại sau!');
  }
});

// ============ LỆNH /start ============
bot.start(async (ctx) => {
  await ctx.replyWithHTML(
    `🤖 <b>Chào mừng đến Shop Thành Duy!</b>\n\n` +
    `📌 <b>Các lệnh:</b>\n` +
    `/shop – Xem sản phẩm\n` +
    `/balance – Số dư\n` +
    `/history – Lịch sử\n` +
    `/recharge – Nạp tiền\n` +
    `/admin – Quản lý (Admin)\n\n` +
    `💡 Bạn có thể dùng nút bên dưới để điều hướng nhanh.`
  );
});

// ============ LỆNH /shop ============
bot.command('shop', async (ctx) => {
  try {
    await connectToDatabase();
    const products = await Product.find({ stock: { $gt: 0 } });
    if (!products.length) {
      return ctx.reply('🛒 Hiện tại shop chưa có sản phẩm nào.');
    }
    let msg = '🛒 <b>DANH SÁCH SẢN PHẨM</b>\n\n';
    products.forEach((p, i) => {
      msg += `${i+1}. <b>${p.name}</b>\n`;
      msg += `   💰 ${p.price.toLocaleString()}đ\n`;
      msg += `   📦 Còn: ${p.stock}\n`;
      msg += `   ➡️ <code>/buy ${p._id}</code>\n\n`;
    });
    await ctx.replyWithHTML(msg);
  } catch (err) {
    console.error('❌ Lỗi shop:', err);
    ctx.reply('⚠️ Lỗi tải danh sách sản phẩm!');
  }
});

// ============ LỆNH /buy ============
bot.command('buy', async (ctx) => {
  try {
    await connectToDatabase();
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply('❌ Dùng: <code>/buy [productId]</code>');
    }
    const productId = args[1];
    const product = await Product.findById(productId);
    if (!product) {
      return ctx.reply('❌ Sản phẩm không tồn tại!');
    }
    if (product.stock <= 0) {
      return ctx.reply('❌ Sản phẩm đã hết hàng!');
    }
    const user = ctx.user;
    if (user.balance < product.price) {
      return ctx.replyWithHTML(
        `❌ Số dư không đủ!\n` +
        `💰 Bạn có: <b>${user.balance.toLocaleString()}đ</b>\n` +
        `💳 Cần thêm: <b>${(product.price - user.balance).toLocaleString()}đ</b>`
      );
    }

    // Xử lý mua
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

    let msg = `✅ <b>Mua hàng thành công!</b>\n\n`;
    msg += `📦 ${product.name}\n`;
    msg += `💰 ${product.price.toLocaleString()}đ\n`;
    msg += `📋 Mã đơn: #${order._id.toString().slice(-6)}\n\n`;
    if (product.type === 'account') {
      msg += `🔐 <b>Thông tin tài khoản:</b>\n`;
      msg += `👤 ${product.accUsername || 'Chưa có'}\n`;
      msg += `🔑 ${product.accPassword || 'Chưa có'}\n`;
    } else if (product.type === 'file') {
      msg += `📁 <b>Link tải file:</b>\n`;
      msg += `${product.fileLink || 'Chưa có'}\n`;
    }
    await ctx.replyWithHTML(msg);
  } catch (err) {
    console.error('❌ Lỗi buy:', err);
    ctx.reply('⚠️ Lỗi xử lý giao dịch!');
  }
});

// ============ LỆNH /balance ============
bot.command('balance', async (ctx) => {
  await ctx.replyWithHTML(`💰 <b>Số dư của bạn:</b>\n\n💵 ${ctx.user.balance.toLocaleString()}đ`);
});

// ============ LỆNH /history ============
bot.command('history', async (ctx) => {
  try {
    await connectToDatabase();
    const orders = await Order.find({ userId: ctx.user.userId })
      .sort({ createdAt: -1 })
      .limit(10);
    if (!orders.length) {
      return ctx.reply('📭 Bạn chưa có đơn hàng nào.');
    }
    let msg = '📋 <b>LỊCH SỬ MUA HÀNG</b>\n\n';
    orders.forEach((o, i) => {
      msg += `${i+1}. <b>${o.productName}</b>\n`;
      msg += `   💰 ${o.price.toLocaleString()}đ\n`;
      msg += `   🕐 ${o.createdAt.toLocaleString('vi-VN')}\n\n`;
    });
    await ctx.replyWithHTML(msg);
  } catch (err) {
    console.error('❌ Lỗi history:', err);
    ctx.reply('⚠️ Lỗi tải lịch sử!');
  }
});

// ============ LỆNH /recharge ============
bot.command('recharge', async (ctx) => {
  await ctx.replyWithHTML(
    `💳 <b>HƯỚNG DẪN NẠP TIỀN</b>\n\n` +
    `1️⃣ Chuyển khoản đến:\n` +
    `   🏦 Ngân hàng: <b>MB Bank</b>\n` +
    `   👤 Chủ TK: <b>LÊ CÔNG THÀNH DUY</b>\n` +
    `   🔢 Số TK: <b>0972864913</b>\n\n` +
    `2️⃣ Nội dung chuyển khoản:\n` +
    `   <code>NAP ${ctx.user.userId}</code>\n\n` +
    `3️⃣ Sau khi chuyển, gửi ảnh biên lai cho Admin.\n` +
    `   👤 Admin sẽ cộng tiền vào tài khoản cho bạn.\n\n` +
    `📌 <b>Lưu ý:</b> Nội dung chuyển khoản PHẢI ĐÚNG để hệ thống xác nhận!`
  );
});

// ============ LỆNH ADMIN ============
bot.command('admin', async (ctx) => {
  if (ctx.user.role !== 'admin') {
    return ctx.reply('⛔ Bạn không có quyền truy cập!');
  }
  await ctx.replyWithHTML(
    `🔑 <b>BẢNG ĐIỀU KHIỂN ADMIN</b>\n\n` +
    `📦 <b>Quản lý sản phẩm:</b>\n` +
    `  ➕ <code>/addproduct "Tên" giá loại user pass</code>\n` +
    `  ➖ <code>/delproduct [id]</code>\n` +
    `  📋 <code>/products</code>\n\n` +
    `👤 <b>Quản lý user:</b>\n` +
    `  💰 <code>/addbalance [userId] [số tiền]</code>\n` +
    `  👤 <code>/users</code>\n\n` +
    `📊 <b>Thống kê:</b>\n` +
    `  📊 <code>/stats</code>`
  );
});

// ============ LỆNH /addproduct ============
bot.command('addproduct', async (ctx) => {
  if (ctx.user.role !== 'admin') {
    return ctx.reply('⛔ Không có quyền!');
  }
  try {
    await connectToDatabase();
    const text = ctx.message.text;
    const first = text.indexOf('"');
    const second = text.indexOf('"', first + 1);
    if (first === -1 || second === -1) {
      return ctx.reply('❌ Dùng: <code>/addproduct "Tên sản phẩm" giá loại user pass</code>');
    }
    const name = text.substring(first + 1, second);
    const parts = text.substring(second + 1).trim().split(' ');
    if (parts.length < 2) {
      return ctx.reply('❌ Thiếu thông tin!');
    }
    const price = parseInt(parts[0]);
    if (!price || price <= 0) {
      return ctx.reply('❌ Giá không hợp lệ!');
    }
    const type = parts[1];
    let accUser = '',
      accPass = '',
      fileLink = '';
    if (type === 'account') {
      accUser = parts[2] || '';
      accPass = parts[3] || '';
      if (!accUser || !accPass) {
        return ctx.reply('❌ Cần username và password!');
      }
    } else if (type === 'file') {
      fileLink = parts[2] || '';
      if (!fileLink) {
        return ctx.reply('❌ Cần link file!');
      }
    } else {
      return ctx.reply('❌ Loại sản phẩm phải là "account" hoặc "file"');
    }
    const product = new Product({
      name,
      price,
      stock: 1,
      type,
      accUsername: accUser,
      accPassword: accPass,
      fileLink
    });
    await product.save();
    await ctx.replyWithHTML(
      `✅ <b>Đã thêm sản phẩm thành công!</b>\n\n` +
      `📦 ${name}\n` +
      `💰 ${price.toLocaleString()}đ\n` +
      `📂 Loại: ${type}\n` +
      `🆔 <code>${product._id}</code>`
    );
  } catch (err) {
    console.error('❌ Lỗi addproduct:', err);
    ctx.reply('⚠️ Lỗi thêm sản phẩm!');
  }
});

// ============ LỆNH /delproduct ============
bot.command('delproduct', async (ctx) => {
  if (ctx.user.role !== 'admin') {
    return ctx.reply('⛔ Không có quyền!');
  }
  try {
    await connectToDatabase();
    const id = ctx.message.text.split(' ')[1];
    if (!id) {
      return ctx.reply('❌ Dùng: /delproduct [productId]');
    }
    const result = await Product.findByIdAndDelete(id);
    if (result) {
      await ctx.reply(`✅ Đã xóa sản phẩm: ${result.name}`);
    } else {
      await ctx.reply('❌ Không tìm thấy sản phẩm!');
    }
  } catch (err) {
    console.error('❌ Lỗi delproduct:', err);
    ctx.reply('⚠️ Lỗi xóa sản phẩm!');
  }
});

// ============ LỆNH /products ============
bot.command('products', async (ctx) => {
  if (ctx.user.role !== 'admin') {
    return ctx.reply('⛔ Không có quyền!');
  }
  try {
    await connectToDatabase();
    const products = await Product.find().sort({ createdAt: -1 });
    if (!products.length) {
      return ctx.reply('📭 Chưa có sản phẩm nào.');
    }
    let msg = '📦 <b>DANH SÁCH SẢN PHẨM (Admin)</b>\n\n';
    products.forEach((p, i) => {
      msg += `${i+1}. <b>${p.name}</b>\n`;
      msg += `   💰 ${p.price.toLocaleString()}đ | 📦 Còn: ${p.stock}\n`;
      msg += `   📂 Loại: ${p.type}\n`;
      msg += `   🆔 <code>${p._id}</code>\n`;
      if (p.type === 'account') {
        msg += `   👤 ${p.accUsername} | 🔑 ${p.accPassword}\n`;
      }
      msg += `\n`;
    });
    await ctx.replyWithHTML(msg);
  } catch (err) {
    console.error('❌ Lỗi products:', err);
    ctx.reply('⚠️ Lỗi tải danh sách sản phẩm!');
  }
});

// ============ LỆNH /addbalance ============
bot.command('addbalance', async (ctx) => {
  if (ctx.user.role !== 'admin') {
    return ctx.reply('⛔ Không có quyền!');
  }
  try {
    await connectToDatabase();
    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
      return ctx.reply('❌ Dùng: /addbalance [userId] [số_tiền]');
    }
    const userId = args[1];
    const amount = parseInt(args[2]);
    if (!amount || amount <= 0) {
      return ctx.reply('❌ Số tiền không hợp lệ!');
    }
    const user = await User.findOne({ userId });
    if (!user) {
      return ctx.reply('❌ Không tìm thấy user!');
    }
    user.balance += amount;
    await user.save();
    await ctx.replyWithHTML(
      `✅ Đã cộng <b>${amount.toLocaleString()}đ</b> cho user:\n` +
      `👤 ${user.username || user.userId}\n` +
      `💰 Số dư mới: <b>${user.balance.toLocaleString()}đ</b>`
    );
    // Gửi thông báo cho user
    try {
      await ctx.telegram.sendMessage(
        userId,
        `💰 Bạn được cộng <b>${amount.toLocaleString()}đ</b>!\nSố dư: ${user.balance.toLocaleString()}đ`,
        { parse_mode: 'HTML' }
      );
    } catch (e) { /* User đã block bot hoặc không nhận được */ }
  } catch (err) {
    console.error('❌ Lỗi addbalance:', err);
    ctx.reply('⚠️ Lỗi cộng tiền!');
  }
});

// ============ LỆNH /users ============
bot.command('users', async (ctx) => {
  if (ctx.user.role !== 'admin') {
    return ctx.reply('⛔ Không có quyền!');
  }
  try {
    await connectToDatabase();
    const users = await User.find().sort({ createdAt: -1 }).limit(20);
    if (!users.length) {
      return ctx.reply('📭 Chưa có user nào.');
    }
    let msg = '👤 <b>DANH SÁCH USER</b>\n\n';
    users.forEach((u, i) => {
      msg += `${i+1}. ${u.username || 'No name'}\n`;
      msg += `   🆔 <code>${u.userId}</code>\n`;
      msg += `   💰 ${u.balance.toLocaleString()}đ\n`;
      msg += `   🔑 Vai trò: ${u.role}\n\n`;
    });
    await ctx.replyWithHTML(msg);
  } catch (err) {
    console.error('❌ Lỗi users:', err);
    ctx.reply('⚠️ Lỗi tải danh sách user!');
  }
});

// ============ LỆNH /stats ============
bot.command('stats', async (ctx) => {
  if (ctx.user.role !== 'admin') {
    return ctx.reply('⛔ Không có quyền!');
  }
  try {
    await connectToDatabase();
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments();
    const revenue = await Order.aggregate([
      { $group: { _id: null, total: { $sum: '$price' } } }
    ]);
    const totalRevenue = revenue[0]?.total || 0;
    await ctx.replyWithHTML(
      `📊 <b>THỐNG KÊ HỆ THỐNG</b>\n\n` +
      `👤 Số user: <b>${totalUsers}</b>\n` +
      `📦 Số sản phẩm: <b>${totalProducts}</b>\n` +
      `📋 Số đơn hàng: <b>${totalOrders}</b>\n` +
      `💰 Doanh thu: <b>${totalRevenue.toLocaleString()}đ</b>`
    );
  } catch (err) {
    console.error('❌ Lỗi stats:', err);
    ctx.reply('⚠️ Lỗi thống kê!');
  }
});

// ============ XỬ LÝ LỖI CHUNG ============
bot.catch((err, ctx) => {
  console.error(`❌ Lỗi bot:`, err);
  ctx.reply('⚠️ Đã có lỗi xảy ra, vui lòng thử lại sau!');
});

// ============ WEBHOOK HANDLER CHO VERCEL ============
module.exports = async (req, res) => {
  console.log(`📩 Webhook received: ${req.method} ${req.url}`);
  
  // Chỉ chấp nhận POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await bot.handleUpdate(req.body, res);
  } catch (err) {
    console.error('❌ Lỗi webhook:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
