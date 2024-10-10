const CartService = require("../services/cart.service");
const CartNormalizer = require("../normalizers/cart.normalizer");
const ValidationUtils = require("../utils/validation.utils");
const mongoose = require("mongoose");
const CartModel = require("../models/cart.model");
const ProductModel = require("../models/product.model");

class CartController {
    static async updateCart(req, res) {
    const { error } = ValidationUtils.updateCartValidation(req.body);
    if (error) {
        return res.status(400).json({ error: true, message: error.details[0].message });
    }

    // Проверяем, авторизован ли пользователь
    if (!req.user) {
        // Если пользователь не авторизован, храним товары в сессии
        if (!req.session.cart) {
            req.session.cart = { items: [] };
        }

        const quantity = Number.parseInt(req.body.quantity);
        const productId = req.body.productId;

        const indexFound = req.session.cart.items.findIndex(item => item.product && item.product.toString() === productId);
        
        if (indexFound > -1) {
            if (quantity <= 0) {
                req.session.cart.items.splice(indexFound, 1); // Удаляем товар, если количество <= 0
            } else {
                req.session.cart.items[indexFound].quantity = quantity; // Обновляем количество
            }
        } else if (indexFound === -1 && quantity > 0) {
            req.session.cart.items.push({
                product: new mongoose.Types.ObjectId(productId),
                quantity: quantity,
            }); // Добавляем новый товар
        } else {
            return res.status(400).json({ error: true, message: "Проверьте отправляемые данные" });
        }

        // Сохраняем обновлённую корзину в сессии
        return res.json(req.session.cart); // Возвращаем обновлённую корзину
    }

    // Если пользователь авторизован, получаем корзину из базы данных
    const cartModel = await CartService.getCart(req.user, req.session.id);

    if (!cartModel) {
        return res.status(404).json({ error: true, message: "Корзина не найдена" });
    }

    const quantity = Number.parseInt(req.body.quantity);
    const productId = req.body.productId;

    try {
        const product = await ProductModel.findOne({ _id: productId });
        if (!product) {
            return res.status(404).json({ error: true, message: 'Товар не найден' });
        }
    } catch (e) {
        return res.status(404).json({ error: true, message: 'Товар не найден' });
    }

    if (!cartModel.items) {
        cartModel.items = [];
    }
    console.log(cartModel.items);
    const indexFound = cartModel.items.findIndex(item => item.product && item.product._id && (item.product._id.toString() === productId));
    if (indexFound > -1) {
        if (quantity <= 0) {
            cartModel.items.splice(indexFound, 1);
        } else {
            cartModel.items[indexFound].quantity = quantity;
        }
    } else if (indexFound === -1 && quantity > 0) {
        cartModel.items.push({
            product: new mongoose.Types.ObjectId(productId),
            quantity: quantity,
        });
    } else {
        return res.status(400).json({ error: true, message: "Проверьте отправляемые данные" });
    }

    await cartModel.save();
    await CartModel.populate(cartModel, { path: 'items.product' });
    res.json(CartNormalizer.normalize(cartModel));
}



    static async getCartCount(req, res) {
        const cart = await CartService.getCart(req.user, req.session.id);

        if (!cart) {
            return res.status(404)
                .json({error: true, message: "Корзина не найдена"});
        }

        let count = 0;
        cart.items.forEach(item => {
            count += item.quantity;
        })

        res.json({count: count});
    }

    static async clearCart(req, res) {
        const cart = await CartService.getCart(req.user, req.session.id);

        if (!cart) {
            return res.status(404)
                .json({error: true, message: "Корзина не найдена"});
        }

        try {
            await CartService.clearCart(cart);
        } catch (e) {
            console.log(e);
            return res.status(500).json({error: true, message: 'Не удалось очистить корзину'});
        }

        res.json({error: false, message: "Корзина очищена"});
    }
}

module.exports = CartController;
