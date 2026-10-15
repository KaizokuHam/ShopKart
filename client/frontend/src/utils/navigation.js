export function returnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes(String.fromCharCode(92)) || Array.from(value).some(character => character.charCodeAt(0) < 32)) return "/home";
  if (["/login", "/signup", "/register"].includes(value.split(/[?#]/)[0])) return "/home";
  return value;
}
