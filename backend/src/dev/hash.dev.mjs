import bcrypt from "bcrypt"

const plainText = process.argv[2]

if (!plainText) console.log(`Falta escribir la contraseña a hashear`)
else console.log( await bcrypt.hash(plainText, 10) )

process.exit()