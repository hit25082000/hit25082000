// Presence check only: never print, persist, or send the credential.
const configured = typeof process.env.TYPESAFE_API_KEY === "string" && process.env.TYPESAFE_API_KEY.trim().length > 0;
console.log(configured
  ? "TYPESAFE_API_KEY disponível neste processo. O segredo do Sites é configurado separadamente; a credencial ainda não foi validada com a TypeSafe."
  : "TYPESAFE_API_KEY ausente neste processo. Cadastre o valor na seção Segredos do ambiente do Codex, sem colocá-lo no código ou no chat.");
process.exitCode = configured ? 0 : 1;
