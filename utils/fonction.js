function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}






module.exports = { randomInt, wait }