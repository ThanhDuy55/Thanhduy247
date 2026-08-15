const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');

// ============ BIẾN MÔI TRƯỜNG ============
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

console.log('🚀 Bot đang khởi động...');
console.log('🔑 BOT_TOKEN:', BOT_TOKEN ? '✅ Đã có token' : '❌ Thiếu token');
console.log('📦 MONGO_URI:', MONGO_URI ? '✅ Đã có uri' : '❌ Thiếu uri');

// ============ KẾT NỐI MONGODB ============
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    console.log('✅ Dùng cached connection');
    return cachedDb;
  }
  
  try {
    console.log('🔄 Đang kết nối MongoDB...');
    const conn = await mongoose.connect(MONGO_URI, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });
    cachedDb = conn;
    console.log('✅ Kết nối MongoDB thành công!');
    return conn;
  } catch (err) {
    console.error('❌ Lỗi kết nối MongoDB:', err.message);
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
  image: { type: String, default: '' },
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

// ============ MIDDLEWARE ============
bot.use(async (ctx, next) => {
  if (!ctx.from) {
    console.log('⚠️ Không có từ trường');
    return next();
  }
  
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
      console.log(`👤 User mới: ${userId} - ${user.username}`);
    }
    
    ctx.user = user;
    await next();
  } catch (err) {
    console.error('❌ Lỗi middleware:', err.message);
    await ctx.reply('⚠️ Lỗi kết nối database, vui lòng thử lại!');
  }
});

// ============ LỆNH /start ============
bot.start(async (ctx) => {
  console.log(`📩 /start từ ${ctx.from.id}`);
  
  const keyboard = Markup.keyboard([
    ['🛒 Xem shop', '💰 Số dư'],
    ['📋 Lịch sử', '💳 Nạp tiền'],
    ['📚 Hướng dẫn', '📞 Hỗ trợ']
  ]).resize();

  await ctx.replyWithHTML(
    `🤖 <b>CHÀO MỪNG ĐẾN SHOP THÀNH DUY!</b>\n\n` +
    `📌 <b>DANH SÁCH LỆNH:</b>\n\n` +
    `🛒 /shop - Xem sản phẩm\n` +
    `💰 /balance - Xem số dư\n` +
    `📋 /history - Xem lịch sử mua\n` +
    `💳 /recharge - Nạp tiền\n` +
    `📚 /help - Hướng dẫn\n\n` +
    `🔑 <b>Hướng dẫn mua hàng:</b>\n` +
    `1️⃣ Gõ /shop để xem sản phẩm\n` +
    `2️⃣ Chọn ID sản phẩm (dãy chữ số)\n` +
    `3️⃣ Gõ /buy [ID] để mua\n\n` +
    `📞 <b>Hỗ trợ:</b> @ankaryios`,
    keyboard
  );
});

// ============ LỆNH /help ============
bot.command('help', async (ctx) => {
  await ctx.replyWithHTML(
    `📚 <b>HƯỚNG DẪN SỬ DỤNG</b>\n\n` +
    `🛒 <b>/shop</b> - Xem danh sách sản phẩm\n` +
    `💰 <b>/balance</b> - Xem số dư\n` +
    `📋 <b>/history</b> - Xem lịch sử mua\n` +
    `💳 <b>/recharge</b> - Hướng dẫn nạp tiền\n` +
    `👤 <b>/start</b> - Menu chính\n\n` +
    `📌 <b>Ví dụ mua hàng:</b>\n` +
    `<code>/buy 65f1a2b3c4d5</code>\n\n` +
    `📞 <b>Hỗ trợ:</b> @ankaryios`
  );
});

// ============ XỬ LÝ NÚT BẤM ============
bot.hears('🛒 Xem shop', async (ctx) => {
  await ctx.reply('🔄 Đang tải...');
  await bot.telegram.sendMessage(ctx.chat.id, '/shop');
});

bot.hears('💰 Số dư', async (ctx) => {
  await ctx.reply('🔄 Đang kiểm tra...');
  await bot.telegram.sendMessage(ctx.chat.id, '/balance');
});

bot.hears('📋 Lịch sử', async (ctx) => {
  await ctx.reply('🔄 Đang tải...');
  await bot.telegram.sendMessage(ctx.chat.id, '/history');
});

bot.hears('💳 Nạp tiền', async (ctx) => {
  await ctx.reply('🔄 Đang tải...');
  await bot.telegram.sendMessage(ctx.chat.id, '/recharge');
});

bot.hears('📚 Hướng dẫn', async (ctx) => {
  await ctx.reply('🔄 Đang tải...');
  await bot.telegram.sendMessage(ctx.chat.id, '/help');
});

bot.hears('📞 Hỗ trợ', async (ctx) => {
  await ctx.replyWithHTML(
    `📞 <b>HỖ TRỢ</b>\n\n` +
    `💬 Telegram: @ankaryios\n` +
    `📱 Zalo: 0372864913\n\n` +
    `⏰ 8:00 - 22:00 hàng ngày`
  );
});

// ============ LỆNH /shop ============
bot.command('shop', async (ctx) => {
  console.log(`📩 /shop từ ${ctx.from.id}`);
  
  try {
    await connectToDatabase();
    const products = await Product.find({ stock: { $gt: 0 } });
    
    if (!products.length) {
      return ctx.reply('🛒 Chưa có sản phẩm nào!');
    }
    
    let msg = '🛒 <b>SẢN PHẨM</b>\n\n';
    products.forEach((p, i) => {
      msg += `${i+1}. <b>${p.name}</b>\n`;
      msg += `   💰 ${p.price.toLocaleString()}đ\n`;
      msg += `   📦 Còn: ${p.stock}\n`;
      msg += `   ➡️ <code>/buy ${p._id}</code>\n\n`;
    });
    
    await ctx.replyWithHTML(msg);
  } catch (err) {
    console.error('❌ Lỗi shop:', err.message);
    ctx.reply('⚠️ Lỗi tải sản phẩm!');
  }
});

// ============ LỆNH /balance ============
bot.command('balance', async (ctx) => {
  console.log(`📩 /balance từ ${ctx.from.id}`);
  
  try {
    await connectToDatabase();
    const user = await User.findOne({ userId: ctx.user.userId });
    if (!user) return ctx.reply('❌ Không tìm thấy user!');
    
    await ctx.replyWithHTML(
      `💰 <b>Số dư của bạn</b>\n\n` +
      `💵 ${user.balance.toLocaleString()}đ`
    );
  } catch (err) {
    console.error('❌ Lỗi balance:', err.message);
    ctx.reply('⚠️ Lỗi kiểm tra số dư!');
  }
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
      msg += `${i+1}. ${o.productName}\n`;
      msg += `   💰 ${o.price.toLocaleString()}đ\n`;
      msg += `   🕐 ${o.createdAt.toLocaleString('vi-VN')}\n\n`;
    });
    
    await ctx.replyWithHTML(msg);
  } catch (err) {
    console.error('❌ Lỗi history:', err.message);
    ctx.reply('⚠️ Lỗi tải lịch sử!');
  }
});

// ============ LỆNH /recharge ============
bot.command('recharge', async (ctx) => {
  await ctx.replyWithHTML(
    `💳 <b>HƯỚNG DẪN NẠP TIỀN</b>\n\n` +
    `🏦 <b>Ngân hàng:</b> MB Bank\n` +
    `👤 <b>Chủ TK:</b> LE CONG THANH DUY\n` +
    `🔢 <b>Số TK:</b> 233765\n\n` +
    `📌 <b>Nội dung:</b> <code>NAP ${ctx.user.userId}</code>\n\n` +
    `✅ Sau khi chuyển, CHỤP MÀN HÌNH và GỬI cho Admin.\n\n` +
    `📞 <b>Liên hệ:</b> @ankaryios`
  );
});

// ============ LỆNH /buy ============
bot.command('buy', async (ctx) => {
  console.log(`📩 /buy từ ${ctx.from.id}`);
  
  try {
    await connectToDatabase();
    const args = ctx.message.text.split(' ');
    
    if (args.length < 2) {
      return ctx.reply('❌ Dùng: <code>/buy [ID]</code>');
    }
    
    const product = await Product.findById(args[1]);
    if (!product) return ctx.reply('❌ Sản phẩm không tồn tại!');
    if (product.stock <= 0) return ctx.reply('❌ Hết hàng!');
    
    const user = await User.findOne({ userId: ctx.user.userId });
    if (!user) return ctx.reply('❌ Không tìm thấy user!');
    
    if (user.balance < product.price) {
      return ctx.replyWithHTML(
        `❌ Số dư không đủ!\n` +
        `💰 Bạn có: ${user.balance.toLocaleString()}đ\n` +
        `💳 Cần thêm: ${(product.price - user.balance).toLocaleString()}đ\n\n` +
        `📌 Vui lòng nạp tiền: /recharge`
      );
    }
    
    // Trừ tiền và cập nhật
    user.balance -= product.price;
    await user.save();
    
    product.stock -= 1;
    await product.save();
    
    // Tạo đơn hàng
    const order = new Order({
      userId: user.userId,
      productId: product._id,
      productName: product.name,
      price: product.price
    });
    await order.save();
    
    let msg = `✅ <b>MUA THÀNH CÔNG!</b>\n\n`;
    msg += `📦 ${product.name}\n`;
    msg += `💰 ${product.price.toLocaleString()}đ\n\n`;
    
    if (product.type === 'account') {
      msg += `👤 ${product.accUsername}\n`;
      msg += `🔑 ${product.accPassword}`;
    } else if (product.type === 'file') {
      msg += `📥 ${product.fileLink}`;
    }
    
    await ctx.replyWithHTML(msg);
  } catch (err) {
    console.error('❌ Lỗi buy:', err.message);
    ctx.reply('⚠️ Lỗi xử lý giao dịch!');
  }
});

// ============ LỆNH ADMIN ============
bot.command('admin', async (ctx) => {
  if (ctx.user.role !== 'admin') {
    return ctx.reply('⛔ Không có quyền!');
  }
  
  await ctx.replyWithHTML(
    `🔑 <b>BẢNG ĐIỀU KHIỂN ADMIN</b>\n\n` +
    `➕ <code>/addproduct "Tên" giá account user pass</code>\n` +
    `➕ <code>/addproduct "Tên" giá file "link"</code>\n` +
    `➖ <code>/delproduct [ID]</code>\n` +
    `📋 <code>/products</code>\n` +
    `💰 <code>/addbalance [userId] [số tiền]</code>\n` +
    `👤 <code>/users</code>\n` +
    `📊 <code>/stats</code>`
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
    
    // Tìm tên sản phẩm trong dấu ngoặc kép
    const first = text.indexOf('"');
    const second = text.indexOf('"', first + 1);
    
    if (first === -1 || second === -1) {
      return ctx.replyWithHTML(
        '❌ <b>Cú pháp sai!</b>\n\n' +
        '📌 <b>Ví dụ:</b>\n' +
        '<code>/addproduct "Tài khoản Netflix" 50000 account user pass</code>\n' +
        '<code>/addproduct "Khóa học" 100000 file "https://link.com"</code>'
      );
    }
    
    const name = text.substring(first + 1, second);
    const rest = text.substring(second + 1).trim().split(' ');
    
    if (rest.length < 3) {
      return ctx.reply('❌ Thiếu thông tin! Cần: giá loại username password');
    }
    
    const price = parseInt(rest[0]);
    if (isNaN(price) || price <= 0) {
      return ctx.reply('❌ Giá phải là số dương!');
    }
    
    const type = rest[1];
    if (type !== 'account' && type !== 'file') {
      return ctx.reply('❌ Loại phải là "account" hoặc "file"');
    }
    
    let accUser = '', accPass = '', fileLink = '';
    
    if (type === 'account') {
      if (rest.length < 4) {
        return ctx.reply('❌ Thiếu username và password!');
      }
      accUser = rest[2] || '';
      accPass = rest[3] || '';
    } else if (type === 'file') {
      if (rest.length < 3) {
        return ctx.reply('❌ Cần link file!');
      }
      fileLink = rest[2] || '';
    }
    
    const product = new Product({
      name,
      price,
      stock: 1,
      type,
      accUsername: accUser,
      accPassword: accPass,
      fileLink,
      image: ''
    });
    
    await product.save();
    
    await ctx.replyWithHTML(
      `✅ <b>Đã thêm sản phẩm!</b>\n\n` +
      `📦 ${name}\n` +
      `💰 ${price.toLocaleString()}đ\n` +
      `🆔 <code>${product._id}</code>`
    );
  } catch (err) {
    console.error('❌ Lỗi addproduct:', err.message);
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
    if (!id) return ctx.reply('❌ Dùng: /delproduct [ID]');
    
    const result = await Product.findByIdAndDelete(id);
    await ctx.reply(result ? `✅ Đã xóa ${result.name}` : '❌ Không tìm thấy');
  } catch (err) {
    console.error('❌ Lỗi delproduct:', err.message);
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
      return ctx.reply('📭 Chưa có sản phẩm.');
    }
    
    let msg = '📦 <b>DANH SÁCH SẢN PHẨM</b>\n\n';
    products.forEach((p, i) => {
      msg += `${i+1}. ${p.name}\n`;
      msg += `   💰 ${p.price.toLocaleString()}đ\n`;
      msg += `   📦 Còn: ${p.stock}\n`;
      msg += `   🆔 <code>${p._id}</code>\n\n`;
    });
    
    await ctx.replyWithHTML(msg);
  } catch (err) {
    console.error('❌ Lỗi products:', err.message);
    ctx.reply('⚠️ Lỗi tải danh sách!');
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
      return ctx.reply('❌ Dùng: /addbalance [userId] [số tiền]');
    }
    
    const userId = args[1];
    const amount = parseInt(args[2]);
    
    if (!amount || amount <= 0) {
      return ctx.reply('❌ Số tiền không hợp lệ!');
    }
    
    const user = await User.findOne({ userId });
    if (!user) return ctx.reply('❌ Không tìm thấy user!');
    
    user.balance += amount;
    await user.save();
    
    await ctx.replyWithHTML(
      `✅ Đã cộng <b>${amount.toLocaleString()}đ</b> cho ${user.username}`
    );
  } catch (err) {
    console.error('❌ Lỗi addbalance:', err.message);
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
      return ctx.reply('📭 Chưa có user.');
    }
    
    let msg = '👤 <b>DANH SÁCH USER</b>\n\n';
    users.forEach((u, i) => {
      msg += `${i+1}. ${u.username || 'No name'}\n`;
      msg += `   🆔 <code>${u.userId}</code>\n`;
      msg += `   💰 ${u.balance.toLocaleString()}đ\n`;
      msg += `   🔑 ${u.role}\n\n`;
    });
    
    await ctx.replyWithHTML(msg);
  } catch (err) {
    console.error('❌ Lỗi users:', err.message);
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
    
    await ctx.replyWithHTML(
      `📊 <b>THỐNG KÊ</b>\n\n` +
      `👤 User: ${totalUsers}\n` +
      `📦 Sản phẩm: ${totalProducts}\n` +
      `📋 Đơn hàng: ${totalOrders}`
    );
  } catch (err) {
    console.error('❌ Lỗi stats:', err.message);
    ctx.reply('⚠️ Lỗi thống kê!');
  }
});

// ============ XỬ LÝ TIN NHẮN THƯỜNG ============
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  
  if (!text.startsWith('/')) {
    await ctx.replyWithHTML(
      `👋 <b>Chào bạn!</b>\n\n` +
      `Vui lòng gõ <code>/start</code> để bắt đầu.`
    );
  }
});

// ============ WEBHOOK HANDLER ============
module.exports = async (req, res) => {
  console.log(`📩 Webhook: ${req.method} ${req.url}`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  try {
    await bot.handleUpdate(req.body, res);
  } catch (err) {
    console.error('❌ Lỗi webhook:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
