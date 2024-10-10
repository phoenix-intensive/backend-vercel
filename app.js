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
async function connectToDatabase() {
    try {
        await mongoose.connect(config.db.dbUrl, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Successfully connected to MongoDB');
        mongoose.set('strictQuery', true);
        await runMigrations(); // Запускаем миграции
    } catch (err) {
        console.error('Connection error:', err);
        process.exit(1); // Завершаем процесс с кодом ошибки
    }
}

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

// Настройка CORS
app.use(cors({ credentials: true, origin: true }));

// Настройка для статических файлов
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Настройка сессий
app.use(session({
    genid: () => uuidv4(), // Генерация уникального идентификатора для сессии
    secret: config.sessionSecret || 'defaultSecret', // Используйте конфиг для секрета
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Используйте secure только в продакшене
        httpOnly: true,
        sameSite: 'lax', // Или 'none', если требуется
    },
}));

// Настройка Passport.js и стратегии JWT
passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromHeader('x-access-token'),
    secretOrKey: config.secret,
    algorithms: ["HS256"],
}, async (payload, next) => {
    try {
        const user = await UserModel.findById(payload.id);
        if (user) {
            return next(null, payload); // Пользователь найден, передаем payload
        }
        return next(new Error('Пользователь не найден'));
    } catch (e) {
        console.error(e);
        return next(e);
    }
}));

app.use(passport.initialize()); // Инициализация Passport.js

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
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Обработка других ошибок
app.use((err, req, res) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({ error: true, message: err.message });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Подключение к базе данных
connectToDatabase();

// Экспорт приложения для использования в других модулях или для развертывания
module.exports = app;
