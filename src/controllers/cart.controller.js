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
            console.log("Validation error:", error.details[0].message);
            return res.status(400).json({ error: true, message: error.details[0].message });
        }

        // Логируем текущее состояние сессии
        console.log('Session before update:', req.session);

        // Если пользователь не авторизован, сохраняем товары в сессии
        if (!req.user) {
            if (!req.session.cart) {
                req.session.cart = { items: [] };
            }

            const quantity = Number.parseInt(req.body.quantity);
            const productId = req.body.productId;

            // Логируем корзину в сессии перед обновлением
            console.log('Current session cart before update (unauthenticated):', req.session.cart);

            const indexFound = req.session.cart.items.findIndex(item => item.product === productId);
            if (indexFound > -1) {
                if (quantity <= 0) {
                    req.session.cart.items.splice(indexFound, 1);
                } else {
                    req.session.cart.items[indexFound].quantity = quantity;
                }
            } else if (indexFound === -1 && quantity > 0) {
                req.session.cart.items.push({
                    product: productId,
                    quantity: quantity,
                });
            } else {
                console.log("Invalid data provided for the cart update");
                return res.status(400).json({ error: true, message: "Проверьте отправляемые данные" });
            }

            // Логируем корзину в сессии после обновления
            console.log('Current session cart after update (unauthenticated):', req.session.cart);
            return res.json(req.session.cart);
        }

        // Если пользователь авторизован, продолжаем с логикой для базы данных
        const cartModel = await CartService.getCart(req.user, req.session.id);

        if (!cartModel) {
            console.log("Cart not found for user:", req.user);
            return res.status(404).json({ error: true, message: "Корзина не найдена" });
        }

        const quantity = Number.parseInt(req.body.quantity);
        const productId = req.body.productId;

        try {
            const product = await ProductModel.findOne({ _id: productId });
            if (!product) {
                console.log("Product not found:", productId);
                return res.status(404).json({ error: true, message: 'Товар не найден' });
            }
        } catch (e) {
            console.error("Error finding product:", e);
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
            console.log("Invalid data provided for the cart update");
            return res.status(400).json({ error: true, message: "Проверьте отправляемые данные" });
        }

        await cartModel.save();
        await CartModel.populate(cartModel, { path: 'items.product' });
        res.json(CartNormalizer.normalize(cartModel));
    }

    static async getCart(req, res) {
        // Логируем корзину в сессии для неавторизованных пользователей
        console.log('Session when fetching cart:', req.session);

        if (!req.user) {
            console.log('Current session cart (unauthenticated):', req.session.cart);
            return res.json(req.session.cart || { items: [] });
        }

        const cart = await CartService.getCart(req.user, req.session.id);

        if (!cart) {
            console.log("Cart not found for user:", req.user);
            return res.status(404).json({ error: true, message: "Корзина не найдена" });
        }

        console.log("Fetched cart for user:", req.user);
        res.json(CartNormalizer.normalize(cart));
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
