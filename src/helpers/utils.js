import { CARD_FIRST_DIGIT_ALLOWED } from "../config/constants.js";

export function validateCardNumbers(cardNumbers) {
    if (!cardNumbers || !Array.isArray(cardNumbers) || !cardNumbers.length) return false;
    for (let card of cardNumbers) {
        if (!validateCardNumber(card)) return false;
    }
    return true;
}

export function validateCardNumber(card) {
    if(!card) return false;
    card = String(card);
    return /^\d{16}$/.test(card) && CARD_FIRST_DIGIT_ALLOWED.includes(Number(card[0]));
}

export function cardIsWestern(card) {
    return String(card)[1] >= 5;
}

export function parseOwnerName(owner) {
    return owner.toLowerCase().split(' ').map((name) => name[0].toUpperCase() + name.slice(1)).join(' ');
}
