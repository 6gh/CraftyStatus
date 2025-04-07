export const parseJson = <T>(jsonString: string): T | null => {
  return JSON.parse(
    jsonString
      // Crafty API returns single quotes, replace with double quotes
      .replace(/'/g, '"')
      // Replace True/False with true/false
      // Fixes SyntaxError: Unexpected token 'F', "False" is not valid JSON
      .replace(/[^"]?(True)|(False)[^"]?/gm, (match) => match.toLowerCase())
  );
};
