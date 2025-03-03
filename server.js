const express = require("express");
const puppeteer = require("puppeteer");
const esprima = require("esprima");
const estraverse = require("estraverse");
const escodegen = require("escodegen");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// Function to simplify JavaScript code
function simplifyAST(ast) {
    estraverse.replace(ast, {
        enter: function (node) {
            // Remove empty blocks
            if (node.type === "BlockStatement" && node.body.length === 0) {
                return this.remove();
            }
            // Inline constant variables
            if (node.type === "VariableDeclarator" && node.init && node.init.type === "Literal") {
                let value = node.init.value;
                let name = node.id.name;
                return { type: "Literal", value: value };
            }
        }
    });
    return ast;
}

// Function to execute JS in a browser and extract deobfuscated output
async function runInBrowser(code) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.evaluate(code);
        let result = await page.evaluate(() => {
            return document.body.innerText || "Execution complete";
        });
        await browser.close();
        return result;
    } catch (error) {
        await browser.close();
        return "Error running script: " + error.message;
    }
}

app.post("/deobfuscate", async (req, res) => {
    try {
        let code = req.body.code;

        // Step 1: Beautify
        let ast = esprima.parseScript(code, { tolerant: true });
        
        // Step 2: Simplify AST (removes junk code, dead code, and inlines variables)
        ast = simplifyAST(ast);

        // Step 3: Generate readable JavaScript
        let deobfuscatedCode = escodegen.generate(ast);

        // Step 4: Run it in a real browser to extract runtime values
        let finalOutput = await runInBrowser(deobfuscatedCode);

        res.json({ success: true, deobfuscatedCode: finalOutput });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.listen(3000, () => console.log("Deobfuscator running on http://localhost:3000"));
