const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const config = require('./src/config/config');
const categoryRoutes = require('./src/routes/category.routes');
const typeRoutes = require('./src/routes/type.routes');
const productRoutes = require('./src/routes/product.routes');
const cartRoutes = require('./src/routes/cart.routes');
const authRoutes = require('./src/routes/auth.routes');
const favoriteRoutes = require('./src/routes/favorite.routes');
const orderRoutes = require('./src/routes/order.routes');
const userRoutes = require('./src/routes/user.routes');
const UserModel = require('./src/models/user.model');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const migrateMongo = require('migrate-mongo');

// Подключение к MongoDB
mongoose.connect(config.db.dbUrl, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('Successfully connected to MongoDB');
        mongoose.set('strictQuery', true);
        return runMigrations(); // Запускаем миграции
    })
    .catch(err => console.error('Connection error', err));

// Функция для выполнения миграций
async function runMigrations() {
    const mongoUrl = config.db.dbUrl;

    // Установка конфигурации migrate-mongo
    const configMongo = {
        mongodb: {
            url: mongoUrl,
            options: {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            },
        },
        migrationsDir: 'migrations',
        changelogCollectionName: 'changelog',
    };

    migrateMongo.config.set(configMongo);

    try {
        await migrateMongo.config.read();
        const { db, client } = await migrateMongo.database.connect();
        const migrated = await migrateMongo.up(db, client);
        console.log('Migrations completed successfully:', migrated);
        await client.close();
    } catch (error) {
        console.error('Error running migrations:', error);
    }
}

// Создание Express приложения
const app = express();

// Настройка CORS (добавьте это)
app.use(cors({ origin: '*', credentials: true }));

// Настройка для статических файлов
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Настройка сессий
app.use(session({
    genid: function (req) {
        return uuidv4();
    },
    secret: '0SddfAS9fAdFASASSFwdVCXLZJKHfss',
    resave: false,
    saveUninitialized: true,
}));

// Настройка Passport.js и стратегии JWT
passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromHeader('x-access-token'),
    secretOrKey: config.secret,
    algorithms: ["HS256"],
}, async (payload, next) => {
    if (!payload.id) {
        return next(new Error('Не валидный токен'));
    }

    try {
        const user = await UserModel.findOne({ _id: payload.id });
        if (user) {
            return next(null, payload);
        }
        next(new Error('Пользователь не найден'));
    } catch (e) {
        console.log(e);
        next(e);
    }
}));

app.use(passport.initialize());

// Подключение маршрутов
app.use("/api", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/types", typeRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/user", userRoutes);

// Обработка 404 ошибки
app.use((req, res, next) => {
    res.status(404).json({ error: 'Not Found' });
});

// Обработка других ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({ error: true, message: err.message });
});

// Удаление ручного запуска сервера
module.exports = app; // Экспорт приложения для Vercel
