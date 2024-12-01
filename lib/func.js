const fetch = require("node-fetch")
const axios = require("axios")

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

const ai = {

async berita(q) {
    const url = 'https://www.blackbox.ai/api/check';
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://www.blackbox.ai/chat/WqotDtS?model=gpt-4o',
        'Content-Type': 'application/json'
    };

    const body = {
        query: q,
        messages: [
            {
                role: q,
                content: q,
                id: generateId()
            }
        ],
        index: null
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
            compress: true 
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data
    } catch (error) {
        console.error('Error:', error);
    }
},

async realistic(prompt) {
  try {
    return await new Promise(async(resolve, reject) => {
      if(!prompt) return reject("failed reading undefined prompt!");
      axios.post("https://aiimagegenerator.io/api/model/predict-peach", {
        prompt,
        negativePrompt: "nsfw, nude, uncensored, cleavage, nipples",
        key: "Waifu",
        width: 512,
        height: 768,
        quantity: 1,
        size: "512x768"
      }).then(res => {
        const data = res.data;
        if(data.code !== 0) return reject(data.message);
        if(data.data.safetyState === "RISKY") return reject("nsfw image was generated, you try create other image again!")
        if(!data.data?.url) return reject("failed generating image!")
        return resolve({
          status: true,
          image: data.data.url
        })
      }).catch(reject)
    })
  } catch (e) {
    return {
      status: false,
      message: e
    }
  }
},

async bing(prompt) {
   const res = await axios.get("https://api.wzblueline.xyz/api/ai/bing-image?prompt=" + prompt, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "ez3-N5mU-tlc2u"
      }
    })
   return res.data.value
}

}

module.exports = {
     ai
  }
  