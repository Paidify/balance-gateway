import { CARD_FIRST_DIGIT_ALLOWED } from "../config/constants.js";

export function validateCardNumbers(cardNumbers) {
    if (!cardNumbers || !Array.isArray(cardNumbers) || !cardNumbers.length) return false;
    for (let card of cardNumbers) {
        card = String(card);
        if (!/^\d{16}$/.test(card) || !CARD_FIRST_DIGIT_ALLOWED.includes(Number(card[0]))) return false;
    }
    return true;
}

export function cardIsWestern(card) {
    return String(card)[1] >= 5;
}
