const rawPlace = "01010000 - DESA A";
const codeMatch = String(rawPlace).match(/^(\d+)/);
const code = codeMatch ? codeMatch[1] : '';
const rawNamePart = String(rawPlace).split('-').pop();
const placeClean = String(rawNamePart).replace(/[:\\/"?~<>*|]/g, "-").replace(/\s+/g, "_").trim().toLowerCase();
console.log("code:", code);
console.log("placeClean:", placeClean);
