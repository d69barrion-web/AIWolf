import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

app.use(cors());
app.use(express.json());

/*
==================================================
OPENAI CLIENT
==================================================
*/

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


/*
==================================================
AIWOLF SYSTEM INSTRUCTIONS
==================================================
*/

const AIWOLF_INSTRUCTIONS = `
Ikaw si AIWolf, isang AI reading companion ng
aklat na "Palakihin ang Lobo, Huwag ang Tupa."

Ang pangunahing trabaho mo ay tulungan ang mambabasa na:

- maunawaan ang chapter
- magtanong
- mag-isip nang mapanuri
- suriin ang mga ideya
- magbigay ng sariling dahilan
- iugnay ang mga ideya sa totoong buhay

MAHALAGANG PRINSIPYO:

1. Huwag mong piliting sumang-ayon ang mambabasa
   sa aklat.

2. Huwag mong sabihing tama ang isang ideya
   dahil lamang sinabi ito ng chapter.

3. Tulungan ang mambabasa na bumuo ng sariling
   konklusyon.

4. Huwag kang mag-imbento ng nilalaman na wala
   sa ibinigay na chapter.

5. Kapag tinatanong tungkol sa eksaktong sinabi
   ng chapter, gamitin lamang ang chapter content
   bilang pangunahing source.

6. Kung ang sagot ay hindi direktang makikita
   sa chapter, sabihin ito nang malinaw.

7. Maaari kang magbigay ng interpretation o
   real-life application, ngunit linawin na ito
   ay interpretation o application at hindi
   direktang sinabi ng chapter.

8. Huwag magpanggap na sinabi ng author ang
   isang bagay na hindi naman nasa chapter.

9. Kung may maling pagkaunawa ang mambabasa,
   itama ito nang mahinahon at ipaliwanag kung bakit.

10. Ang layunin mo ay hindi manalo sa argumento.
    Ang layunin mo ay tumulong sa pag-unawa.

CHILD MODE:

Kapag ang mode ay "child":

- Gumamit ng simple at malinaw na Filipino.
- Gumamit ng konkretong halimbawa.
- Iwasan ang sobrang komplikadong termino.
- Huwag agad ibigay ang sagot kapag mas makabuluhan
  na tanungin muna ang bata kung ano ang kanyang
  sariling iniisip.
- Hikayatin ang curiosity.
- Maging encouraging at hindi mapanghusga.

PARENT MODE:

Kapag ang mode ay "parent":

- Maaari kang magbigay ng mas malalim na paliwanag.
- Magbigay ng discussion questions na maaaring
  gamitin ng magulang at anak.
- Ipaliwanag ang posibleng misunderstanding ng bata.
- Magbigay ng practical examples para sa parent-child
  discussion.

SA PAGPAPALIWANAG:

Kung angkop, paghiwalayin ang:

📖 Ayon sa Chapter
Ano mismo ang sinasabi ng chapter.

🧠 Pag-unawa
Ano ang maaaring ibig sabihin nito.

🌎 Application
Paano ito maaaring maiugnay sa totoong buhay.

TANDAAN:

Hindi mo kailangang kontrahin ang reader.

Hindi mo rin kailangang ipagtanggol ang chapter.

Tulungan mo lamang siyang mag-isip.

IDENTITY NI AIWOLF:

Kapag tinanong kung sino ang lumikha sa iyo:

Sabihin na ikaw ay AIWolf, isang AI reading companion
na ginawa para sa aklat na "Palakihin ang Lobo, Huwag ang Tupa."

Ipaliwanag na ang AI system na nagpapatakbo sa iyo ay
gumagamit ng AI technology mula sa OpenAI, habang ang
iyong role, instructions, personality, at integration
bilang AIWolf ay bahagi ng proyektong ito.

Kapag tinanong:

"Ikaw ba talaga si ChatGPT?"

Sabihin:

"Hindi. AIWolf ang pangalan ko. Gumagamit ako ng AI
technology mula sa OpenAI para makasagot sa iyo, pero
ang role ko rito ay bilang AI reading companion ng
aklat na ito."

Huwag mong sabihing ikaw ay isang tao.

Huwag mong sabihing ikaw ang author ng aklat.

Huwag mong angkinin na ikaw ang sumulat ng aklat.

Huwag ding sabihin na ikaw mismo ang bumuo ng AI system
na nagpapatakbo sa iyo.
`;


/*
==================================================
HEALTH CHECK
==================================================
*/

app.get("/", (req, res) => {

    res.json({
        status: "online",
        service: "AIWolf",
        message: "AIWolf server is running."
    });

});


/*
==================================================
AIWOLF ENDPOINT
==================================================

POST /api/aiwolf

Expected JSON:

{
    "question": "...",
    "chapter": 1,
    "mode": "child",
    "chapterText": "..."
}

==================================================
*/

app.post("/api/aiwolf", async (req, res) => {

    try {

        const {
            question,
            chapter,
            mode,
            chapterText
        } = req.body;


        /*
        ------------------------------------------
        BASIC VALIDATION
        ------------------------------------------
        */

        if (!question || !question.trim()) {

            return res.status(400).json({
                error: "Missing question."
            });

        }


        if (!chapterText || !chapterText.trim()) {

            return res.status(400).json({
                error: "Missing chapter content."
            });

        }


        const selectedMode =
            mode === "parent"
                ? "parent"
                : "child";


        /*
        ------------------------------------------
        BUILD AIWOLF PROMPT
        ------------------------------------------
        */

        const input = `
${AIWOLF_INSTRUCTIONS}

------------------------------------------
CURRENT CHAPTER
------------------------------------------

Chapter number:
${chapter || "Unknown"}

Reader mode:
${selectedMode}

------------------------------------------
CHAPTER CONTENT
------------------------------------------

${chapterText}

------------------------------------------
READER'S QUESTION
------------------------------------------

${question}

------------------------------------------
INSTRUCTIONS FOR THIS RESPONSE
------------------------------------------

Sagutin ang tanong ng reader batay muna sa
chapter content.

Kung ang tanong ay direktang masasagot mula
sa chapter, ipaliwanag iyon.

Kung hindi direktang sinasagot ng chapter,
sabihin:

"Hindi direktang sinasagot iyan ng chapter."

Pagkatapos, kung makakatulong, maaari kang
magbigay ng hiwalay na interpretation o
real-life application.

Huwag mag-imbento ng chapter content.
`;


        /*
        ------------------------------------------
        OPENAI REQUEST
        ------------------------------------------
        */

        const response =
            await client.responses.create({

                model: "gpt-5-mini",

                input: input

            });


        /*
        ------------------------------------------
        SEND RESPONSE BACK TO BROWSER
        ------------------------------------------
        */

        res.json({

            reply: response.output_text

        });


    } catch (error) {

        console.error("AIWolf error:", error);


        /*
        ------------------------------------------
        ERROR HANDLING
        ------------------------------------------
        */

        res.status(500).json({

            error:
                error?.message ||
                "AIWolf server error."

        });

    }

});


/*
==================================================
OLD CHAT ENDPOINT
==================================================

Pinananatili natin ito para hindi masira
ang existing MyChatbot test.

==================================================
*/

app.post("/chat", async (req, res) => {

    try {

        const userMessage =
            req.body.message;


        if (!userMessage) {

            return res.status(400).json({
                error: "Missing message."
            });

        }


        const response =
            await client.responses.create({

                model: "gpt-5-mini",

                input: userMessage

            });


        res.json({

            reply: response.output_text

        });


    } catch (error) {

        console.error(
            "Chat error:",
            error
        );


        res.status(500).json({

            error:
                error?.message ||
                "Something went wrong."

        });

    }

});


/*
==================================================
START SERVER
==================================================
*/

const PORT =
    process.env.PORT || 10000;


app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `AIWolf server running on port ${PORT}`
        );

    }
);
