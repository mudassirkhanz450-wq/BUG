import chalk from "chalk";

function time() {
    return new Date()
        .toLocaleTimeString("id-ID", {
            hour12: false
        });
}

function badge(label, color) {
    return color.bold(`[${label}]`);
}

function print(label, color, msg) {

    console.log(
        `\n${chalk.gray(time())} ${badge(label, color)} ${msg}`
    );

}

export const log = {

    info: (msg) =>
        print("INFO", chalk.cyan, msg),

    success: (msg) =>
        print("SUCCESS", chalk.green, msg),

    warning: (msg) =>
        print("WARNING", chalk.yellow, msg),

    error: (msg) =>
        print("ERROR", chalk.red, msg),

    loading: (msg) =>
        print("PROCESS", chalk.blue, msg),

    whatsapp: (msg) =>
        print("WHATSAPP", chalk.greenBright, msg),

};