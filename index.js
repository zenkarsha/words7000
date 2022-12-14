'use strict';

/*==================================
 BASIC REUIRE
====================================*/
const line = require('@line/bot-sdk');
const express = require('express');
const path = require('path');
const HTMLParser = require('node-html-parser');
const https = require('https');
const { getAudioDurationInSeconds } = require('get-audio-duration')
const fs = require('fs');
const config = {
  channelAccessToken: '',
  channelSecret: '',
};



/*==================================
 CUSTOM REUIRE AND INIT
====================================*/
const client = new line.Client(config);
const app = express();
const words  = require('./words.json');
const words_advance  = require('./words-advance.json');
let echo = { type: 'text', text: '請從選單進行操作 ⬇️' };



/*==================================
 APP REQUEST ACTIONS
====================================*/
app.use('/audio/', express.static('./audio/'));
app.use('/video/', express.static('./video/'));

app.get('/', (req, res) => {
  let html = `<html>
    <head>
      <title>高中7000單</title>
      <script>window.location = "https://line.me/R/ti/p/@323geiqw";</script>
    </head>
    <body style="text-align:center">
      <h1>自動跳轉中⋯⋯</h1>
    </body>
  </html>`;

  res.send(html);
});

app.post('/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

app.on('postback', function (event) {
  console.log(event);
});



/*==================================
 APP ROUTER
====================================*/
function handleEvent(event) {
  if (event.type !== 'message' || event.type !== 'postback')
  {
    switch (event.type) {
      case 'message':
        handleMessageEvent(event);
        break;
      case 'postback':
        handlePostbackEvent(event);
        break;
      default:
        return client.replyMessage(event.replyToken, echo);
    }
  }
  else {
    // ignore non-text-message event
    return Promise.resolve(null);
  }
}

function handleMessageEvent(event) {
  switch (event.message.text) {
    case '開始測驗':
      let question_type_json = createQuestionType(event);
      return client.replyMessage(event.replyToken, [question_type_json]);
      break;
    case '我的字庫':
      return createUserCollection(event);
      break;
    case '得分':
      return handleUserPoints(event);
      break;
    case 'test':
      return client.replyMessage(event.replyToken, echo);
      break;
    default:
      let user = event.source.userId;
      let path = __dirname + `/user_question/${user}.json`;

      if (fs.existsSync(path)) {
        return handleAudioAnswer(event);
      }
      else {
        return client.replyMessage(event.replyToken, echo);
      }
  }
}

function handlePostbackEvent(event) {
  const postback_result = handleUrlParams(event.postback.data);
  switch (postback_result.type) {
    case 'question_type':
      let question_type_json = createQuestion(event, postback_result.question_type);
      return client.replyMessage(event.replyToken, [question_type_json]);
      break;
    case 'answer':
      let answer_result = handleAnswer(event.postback.data)
      if (answer_result) {
        updateUserPoints(event);
        return client.replyMessage(event.replyToken, moreQuestion(postback_result.question_type, postback_result.wid, true));
      }
      else {
        updateUserWrongAnswer(event);
        return client.replyMessage(event.replyToken, moreQuestion(postback_result.question_type, postback_result.wid, false));
      }
      break;
    case 'play_pronounce':
      return playPronounce(event, postback_result.wid);
      break;
    case 'more_question':
      let more_question_json = createQuestion(event, postback_result.question_type, postback_result.wid);
      return client.replyMessage(event.replyToken, [more_question_json]);
      break;
    case 'more_test':
      let question_json = createQuestion(event, postback_result.question_type);
      return client.replyMessage(event.replyToken, [question_json]);
      break;
    case 'add_to_collection':
      return addToUserCollection(event, postback_result.wid);
      break;
    case 'delete_from_my_collection':
      return deleteFromMyCollection(event, postback_result.wid);
      break;
    case 'check_my_collection':
      return createUserCollection(event);
      break;
    case 'check_word':
      return checkWord(event, postback_result.wid);
      break;
    default:
      return client.replyMessage(event.replyToken, echo);
  }
}



/*==================================
 APP FUNCTIONS
====================================*/
function createQuestionType() {
  return {
    "type": "flex",
    "altText": "考試開始，不要作弊！",
    "contents": {
      "type": "bubble",
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "英文出題",
              "displayText": "英文出題",
              "data": "wid=&type=question_type&question_type=english&content=english"
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "中文出題",
              "displayText": "中文出題",
              "data": "wid=&type=question_type&question_type=chinese&content=chinese"
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "發音出題",
              "displayText": "發音出題",
              "data": "wid=&type=question_type&question_type=audio&content=audio"
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "英文出題 (高階)",
              "displayText": "英文出題 (高階)",
              "data": "wid=&type=question_type&question_type=english_advance&content=english_advance"
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "中文出題 (高階)",
              "displayText": "中文出題 (高階)",
              "data": "wid=&type=question_type&question_type=chinese_advance&content=chinese_advance"
            },
            "style": "secondary",
            "adjustMode": "shrink-to-fit"
          }
        ]
      }
    }
  };
}

function createQuestion(event, question_type, current_wid = null) {
  if (question_type == 'audio') {
    return createAudioQuestion(event, question_type, current_wid);
  }
  else {
    let new_words = (question_type == 'english_advance' || question_type == 'chinese_advance') ? words_advance : words;

    if (current_wid !== null) {
      let index = getObjectItemIndex(words, current_wid);
      if (index !== -1) new_words = removeByIndex(new_words, index);
    }

    let w = new_words[Math.floor(Math.random() * new_words.length)];
    let contents = [];
    let question = (question_type == 'english' || question_type == 'english_advance') ? (w.word).replace( new RegExp(/(\w+)\s(\(\w+\.\))/,"g"), "$1") : w.translate;

    let w_text = {
      "type": "text",
      "text": `${question}\n`,
      "size": "xxl",
      "wrap": true
    };

    contents.push(w_text);

    let answers = createAnswers(question_type, w.id);
    answers.push(w);

    let shuffled_answers = answers.sort(function () {
      return Math.random() - 0.5;
    });

    for (let i = 0; i < answers.length; i++) {
      let temp_answer = (question_type == 'english' || question_type == 'english_advance') ? answers[i].translate : answers[i].word;

      contents.push({
        "type": "button",
        "action": {
          "type": "postback",
          "label": (temp_answer).replace( new RegExp(/(\w+)\s(\(\w+\.\))/,"g"), "$1"),
          "displayText": (temp_answer).replace( new RegExp(/(\w+)\s(\(\w+\.\))/,"g"), "$1"),
          "data": `wid=${w.id}&type=answer&question_type=${question_type}&content=${temp_answer}`
        },
        "style": "secondary",
        "adjustMode": "shrink-to-fit"
      });
    }

    return {
      "type": "flex",
      "altText": "考試開始，不要作弊！",
      "contents": {
        "type": "bubble",
        "body": {
          "type": "box",
          "layout": "vertical",
          "spacing": "md",
          "contents": contents
        }
      }
    };
  }
}

function createAudioQuestion(event, question_type, current_wid = null) {
  let new_words = words;

  if (current_wid !== null) {
    let index = getObjectItemIndex(words, current_wid);
    if (index !== -1) new_words = removeByIndex(new_words, index);
  }

  let w = new_words[Math.floor(Math.random() * new_words.length)];

  let user = event.source.userId;
  let path = __dirname + `/user_question/${user}.json`;
  let user_json = [w];

  fs.writeFile(path, JSON.stringify(user_json), function (error, data) {
    if (error) throw error;
  });

  return {
    "type": "flex",
    "altText": "考試開始，不要作弊！",
    "contents": {
      "type": "bubble",
      "hero": {
        "type": "video",
        "url": `https://words7000.unlink.men/video/${w.id}.mp4`,
        "previewUrl": "https://words7000.unlink.men/audio/cover.png",
        "altContent": {
          "type": "image",
          "url": `https://words7000.unlink.men/audio/cover.png`,
          "flex": 1,
          "size": "full",
          "aspectRatio": "16:9",
          "aspectMode": "cover"
        },
        "action": {
          "type": "uri",
          "label": "action",
          "uri": `https://words7000.unlink.men/video/${w.id}.mp4`
        },
        "aspectRatio": "16:9"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "wrap": true,
            "text": "請點擊影片聽取音檔\n並輸入答案後送出"
          }
        ]
      }
    }
  };
}

function createAnswers(question_type, wid, total = 3) {
  let object = [];
  let index;

  let new_words = (question_type == 'english_advance' || question_type == 'chinese_advance') ? words_advance : words;

  if (question_type == 'english_advance' || question_type == 'chinese_advance') {
    total = 5;
    index = getObjectItemIndex(words_advance, wid);
  }
  else {
    index = getObjectItemIndex(words, wid);
  }
  if (index !== -1) new_words = removeByIndex(new_words, index);

  let array_container = [];
  const gen_numbers = Math.floor(Math.random() * new_words.length);
  array_container.push(gen_numbers);

  for (let counter = 0; counter < (new_words.length - 1) && array_container.length < total; counter++) {
    let new_gen = Math.floor(Math.random() * new_words.length);
    while (array_container.lastIndexOf(new_gen) !== -1) {
      new_gen = Math.floor(Math.random() * new_words.length);
    }
    array_container.push(new_gen);
  }

  for (let i = 0; i < total; i++) {
    object.push(new_words[array_container[i]]);
  }

  return object;
}

function moreQuestion(question_type, wid, answer) {
  let w = words.filter(x => x.id == wid);
  let contents = [];

  if (answer) {
    contents.push({
      "type": "text",
      "size": "xl",
      "text": "恭喜、答對了！！！\n"
    });
  }
  else {
    contents.push({
      "type": "text",
      "size": "xl",
      "color": "#ff0000",
      "text": "❌ 答錯了！\n"
    });
  }

  contents.push({
    "type": "separator"
  });

  contents.push({
    "type": "text",
    "wrap": true,
    "text": `${w[0].word}\n翻譯：${w[0].translate}\n`
  });

  contents.push({
    "type": "button",
    "action": {
      "type": "postback",
      "label": "再來一題",
      "displayText": "再來一題",
      "data": `wid=${wid}&type=more_question&question_type=${question_type}&content=再來一題`
    },
    "style": "primary"
  });

  contents.push({
    "type": "button",
    "action": {
      "type": "postback",
      "label": "聽發音",
      "displayText": "聽發音",
      "data": `wid=${wid}&type=play_pronounce&question_type=${question_type}&content=聽發音`
    },
    "style": "secondary"
  });

  return {
    "type": "flex",
    "altText": "再來一題",
    "contents": {
      "type": "bubble",
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": contents
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "separator"
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "加入字庫",
              "displayText": "加入字庫",
              "data": `wid=${wid}&type=add_to_collection&question_type=&content=加入字庫`
            }
          }
        ]
      }
    }
  }
}

function handleAnswer(data) {
  let result = handleUrlParams(data);
  let w;

  if (result.question_type == 'english_advance' || result.question_type == 'chinese_advance')
    w = words_advance.filter(x => x.id == result.wid);
  else
    w = words.filter(x => x.id == result.wid);

  if (result.question_type == 'english' || result.question_type == 'english_advance') {
    return result.content == w[0].translate ? true : false;
  }
  else {
    return result.content == w[0].word ? true : false;
  }
}

function handleAudioAnswer(event) {
  let question_type = "audio";
  let user = event.source.userId;
  let path = __dirname + `/user_question/${user}.json`;

  fs.readFile(path, function (error, data) {
    if (error) throw error;
    else {
      let user_json = JSON.parse(data);
      let user_word = user_json[0].word;
      let wid = user_json[0].id;

      let answer = user_word.replace( new RegExp(/(\w+)\s.+/,"g"), "$1").replace( new RegExp(/é/,"g"), "e").replace( new RegExp(/-/,"g"), "").replace( new RegExp(/\./,"g"), "").replace( new RegExp(/\s/,"g"), "");
      answer = answer.toLowerCase();

      let user_answer = event.message.text;
      user_answer = user_answer.replace( new RegExp(/\s/,"g"), "").replace( new RegExp(/é/,"g"), "e").replace( new RegExp(/-/,"g"), "").replace( new RegExp(/\./,"g"), "");
      user_answer = user_answer.toLowerCase();

      fs.unlink(path,function(err){
        if (err) return console.log(err);
      });

      if (user_answer == answer) {
        updateUserPoints(event);
        return client.replyMessage(event.replyToken, moreQuestion(question_type, wid, true));
      }
      else {
        updateUserWrongAnswer(event);
        return client.replyMessage(event.replyToken, moreQuestion(question_type, wid, false));
      }
    }
  });
}

function createUserCollection(event) {
  let user = event.source.userId;
  let path = __dirname + `/user_words/${user}.json`;

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let user_json = JSON.parse(data);
        let user_words = user_json[0].words;

        if (user_words.length == 0) {
          echo = { type: "text", text: "您的字庫裡尚無任何單字" };
          return client.replyMessage(event.replyToken, echo);
        }
        else {
          let bubble_content = [];
          let box_content = [];

          for (let i = 0; i < user_words.length; i++) {
            let temp_box = {
              "type": "box",
              "layout": "horizontal",
              "spacing": "md",
              "contents": [
                {
                  "type": "text",
                  "wrap": true,
                  "flex": 5,
                  "text": `${user_words[i].word}\n${user_words[i].translate}`
                },
                {
                  "type": "button",
                  "flex": 2,
                  "action": {
                    "type": "postback",
                    "label": "查看",
                    "displayText": "查看",
                    "data": `wid=${user_words[i].id}&type=check_word&content=查看`
                  },
                  "style": "secondary"
                }
              ]
            };
            box_content.push(temp_box);

            if ((parseInt(i) + 1) < user_words.length && (parseInt(i) + 1) % 7 != 0) {
              let separator = {
                "type": "separator"
              };
              box_content.push(separator);
            }

            if ((parseInt(i) + 1) % 7 == 0 || (parseInt(i) + 1) == user_words.length) {
              let temp_bubble = {
                "type": "bubble",
                "body": {
                  "type": "box",
                  "layout": "vertical",
                  "spacing": "md",
                  "contents": box_content
                }
              };

              bubble_content.push(temp_bubble);
              box_content = [];
            }
          }

          return client.replyMessage(event.replyToken, [{
            "type": "flex",
            "altText": "我的字庫",
            "contents": {
              "type": "carousel",
              "contents": bubble_content
            }
          }]);
        }
      }
    });
  }
  else {
    echo = { type: "text", text: "您的字庫裡尚無任何單字" };
    return client.replyMessage(event.replyToken, echo);
  }
}

function checkWord(event, wid) {
  let index = getObjectItemIndex(words, wid);
  let w = words[index];
  let word = (w.word).replace( new RegExp(/é/,"g"), "e").replace( new RegExp(/-/,"g"), "").replace( new RegExp(/\./,"g"), "").replace( new RegExp(/(\w+)\s(\(\w+\.?\))/,"g"), "$1");

  if (word == "BBQ") word = "barbecue";

  let url = "https://cdict.info/query/" + word;

  const request = https.request(url, function(res) {
    let data = '';

    res.on('data', function(chunk) {
      data = data + chunk.toString();
    });

    res.on('end', function() {
      let root = HTMLParser.parse(data);
      let word_pa, word_info;

      if (root.querySelector('.resultbox') == null) {
        word_pa = "";
        word_info = w.translate;
      }
      else {
        if (root.querySelector('.resultbox .dictt') == null)
          word_pa = "";
        else
          word_pa = root.querySelector('.resultbox .dictt').innerText.replace(new RegExp(/(國際音標)/, "g"), "\n國際音標");

        word_info = (root.querySelector('.resultbox').toString()).replace(new RegExp(/<br\s*[\/]?>/, "g"), "\n").replace(new RegExp(/<div class=\"resultbox\"><div class=\"bartop\">(.+)<\/div><div class=\"xbox\">(.+)<\/div>\n<div class=\"dictp\">.+\n\n〈\s.+〉\n\n/,"g"), "").replace(new RegExp(/<div class=\"resultbox\"><div class=\"bartop\">(.+)<\/div><div class=\"xbox\">(.+)<\/div>\n\s<\/div>/,"g"), "").replace(new RegExp(/【/, "g"), "[").replace(new RegExp(/】/, "g"), "]").replace(new RegExp(/(<([^>]+)>)/, "ig"), "");

        if (word_info.includes("找不到相關中英文資料") || word_info.includes("找不到相關片語資料"))
          word_info = w.translate;
      }

      let body_contents = [];

      if (word_pa != "") {
        body_contents.push({
          "type": "text",
          "color": "#999999",
          "size": "xs",
          "wrap": true,
          "text": word_pa
        });

        body_contents.push({
          "type": "separator"
        });
      }

      body_contents.push({
        "type": "text",
        "wrap": true,
        "text": word_info
      });

      return client.replyMessage(event.replyToken, [{
        "type": "flex",
        "altText": "單字詳解",
        "contents": {
          "type": "bubble",
          "header": {
            "type": "box",
            "layout": "vertical",
            "paddingBottom": "xs",
            "contents": [
              {
                "type": "text",
                "size": "xl",
                "text": word
              }
            ]
          },
          "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "md",
            "contents": body_contents
          },
          "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "button",
                "action": {
                  "type": "postback",
                  "label": "聽發音",
                  "displayText": "聽發音",
                  "data": `wid=${wid}&type=play_pronounce&content=聽發音`
                },
                "style": "secondary"
              },
              {
                "type": "button",
                "action": {
                  "type": "postback",
                  "label": "從字庫刪除",
                  "displayText": "從字庫刪除",
                  "data": `wid=${wid}&type=delete_from_my_collection&content=從字庫刪除`
                }
              },
              {
                "type": "separator"
              },
              {
                "type": "button",
                "action": {
                  "type": "postback",
                  "label": "查看字庫",
                  "displayText": "查看字庫",
                  "data": `wid=&type=check_my_collection&content=查看字庫`
                }
              }
            ]
          },
        }
      }]);
    });
  })

  request.on('error', function(err) {
    console.log(err);
  });

  request.end();
}

function playPronounce(event, wid) {
  let index = getObjectItemIndex(words, wid);
  let w = words[index];

  getAudioDurationInSeconds(`https://words7000.unlink.men/audio/${w.id}.m4a`).then((duration) => {
    let milliseconds = duration * 1000;
    echo = {
      "type": "audio",
      "originalContentUrl": `https://words7000.unlink.men/audio/${w.id}.m4a`,
      "duration": milliseconds
    };
    client.replyMessage(event.replyToken, echo);
  });
}

function addToUserCollection(event, wid) {
  let user = event.source.userId;
  let path = __dirname + `/user_words/${user}.json`;
  let user_json = [];

  let index = getObjectItemIndex(words, wid);
  let word = words[index];

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let old_json = JSON.parse(data);
        let user_words = old_json[0].words;
        let user_words_count = user_words.length;

        if (user_words_count == 70) {
          echo = { type: "text", text: "你的字庫達上限，請刪減一些單字" };
          return client.replyMessage(event.replyToken, echo);
        }
        else {
          let word_index = getObjectItemIndex(user_words, word.id);
          if (word_index == -1) {
            user_words.push(word);
            user_json = [{"user": user, "words": user_words}];

            fs.writeFile(path, JSON.stringify(user_json), function (error, data) {
              if (error) throw error;
              else {
                echo = { type: "text", text: "已加入您的字庫" };
                return client.replyMessage(event.replyToken, echo);
              }
            });
          }
          else {
            echo = { type: "text", text: "字彙已在您的字庫中！" };
            return client.replyMessage(event.replyToken, echo);
          }
        }
      }
    });
  }
  else {
    user_json = [{"user": user, "words": [word]}];
    fs.writeFile(path, JSON.stringify(user_json), function (error, data) {
      if (error) throw error;
      else {
        echo = { type: "text", text: "已加入您的字庫" };
        return client.replyMessage(event.replyToken, echo);
      }
    });
  }
}

function deleteFromMyCollection(event, wid) {
  let user = event.source.userId;
  let path = __dirname + `/user_words/${user}.json`;
  let user_json = [];

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let old_json = JSON.parse(data);
        let user_words = old_json[0].words;

        let index = getObjectItemIndex(user_words, wid);
        user_words.splice(index, 1);
        user_json = [{"user": user, "words": user_words}];

        fs.writeFile(path, JSON.stringify(user_json), function (error, data) {
          if (error) throw error;
          else {
            return client.replyMessage(event.replyToken, [{
              "type": "flex",
              "altText": "刪除成功",
              "contents": {
                "type": "bubble",
                "body": {
                  "type": "box",
                  "layout": "vertical",
                  "spacing": "md",
                  "contents": [
                    {
                      "type": "text",
                      "size": "lg",
                      "text": "刪除成功！"
                    },
                    {
                      "type": "button",
                      "action": {
                        "type": "message",
                        "label": "查看我的字庫",
                        "text": "我的字庫"
                      },
                      "style": "secondary"
                    }
                  ]
                }
              }
            }]);
          }
        });
      }
    });
  }
  else {
    echo = { type: "text", text: "找不到您的字庫資料" };
    return client.replyMessage(event.replyToken, echo);
  }
}

function handleUserPoints(event) {
  let user = event.source.userId;
  let path = `./users/${user}.json`;
  let user_json = `[{"user": "${user}", "point": 0, "wrong_answer": 0}]`;

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let current_json = JSON.parse(data)
        return client.replyMessage(event.replyToken, createPointMessage(current_json[0]));
      }
    });
  }
  else {
    fs.writeFile(path, user_json, function (error, data) {
      if (error) {
        console.error(error);
      }
    });

    echo = { type: "text", text: "零分啦！" };
    return client.replyMessage(event.replyToken, echo);
  }
}

function createPointMessage(user_json) {
  let point = user_json.point;
  let wrong_answer = !("wrong_answer" in user_json) ? 0 : user_json.wrong_answer;
  let score = point - wrong_answer;

  let gold_stars = 1;
  if (score >= 2500) gold_stars = 5;
  else if (score >= 1000) gold_stars = 4;
  else if (score >= 500) gold_stars = 3;
  else if (score >= 100) gold_stars = 2;
  else gold_stars = 1;

  let stars_contents = [];
  for (let i = 0; i < gold_stars; i++) {
    stars_contents.push({
      "type": "icon",
      "size": "sm",
      "url": "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gold_star_28.png"
    });
  }

  for (let j = 0; stars_contents.length < 5; j++) {
    stars_contents.push({
      "type": "icon",
      "size": "sm",
      "url": "https://scdn.line-apps.com/n/channel_devcenter/img/fx/review_gray_star_28.png"
    });
  }

  return {
    "type": "flex",
    "altText": "你的分數",
    "contents": {
      "type": "bubble",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "image",
            "url": "https://cdn2.ettoday.net/images/5588/5588832.jpg",
            "flex": 1,
            "size": "full",
            "aspectRatio": "2:1",
            "aspectMode": "cover"
          }
        ],
        "paddingAll": "0px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "spacing": "md",
        "contents": [
          {
            "type": "text",
            "text": `你目前的得分為：${point}分`
          },
          {
            "type": "text",
            "text": `答錯次數：${wrong_answer}次\n\n`
          },
          {
            "type": "box",
            "layout": "baseline",
            "margin": "md",
            "contents": stars_contents
          },
          {
            "type": "button",
            "action": {
              "type": "postback",
              "label": "繼續測驗",
              "displayText": "繼續測驗",
              "data": `type=more_test&content=繼續測驗`
            },
            "style": "primary"
          }
        ]
      }
    }
  };
}

function updateUserPoints(event) {
  let user = event.source.userId;
  let path = __dirname + `/users/${user}.json`;
  let user_json = '';

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let old_json = JSON.parse(data);
        let point = old_json[0].point + 1;
        let wrong_answer = 0

        if (!("wrong_answer" in old_json[0])) wrong_answer = 0
        else wrong_answer = old_json[0].wrong_answer;

        user_json = `[{"user": "${user}", "point": ${point}, "wrong_answer": ${wrong_answer}}]`
        fs.writeFile(path, user_json, function (error, data) {
          if (error) throw error;
        });
      }
    });
  }
  else {
    user_json = `[{"user": "${user}", "point": 1, "wrong_answer": 0}]`
    fs.writeFile(path, user_json, function (error, data) {
      if (error) throw error;
    });
  }
}

function updateUserWrongAnswer(event) {
  let user = event.source.userId;
  let path = __dirname + `/users/${user}.json`;
  let user_json = '';

  if (fs.existsSync(path)) {
    fs.readFile(path, function (error, data) {
      if (error) throw error;
      else {
        let old_json = JSON.parse(data)
        let wrong_answer = 1;

        if (!("wrong_answer" in old_json[0])) wrong_answer = 1;
        else wrong_answer = old_json[0].wrong_answer + 1;

        user_json = `[{"user": "${user}", "point": ${old_json[0].point}, "wrong_answer": ${wrong_answer}}]`
        fs.writeFile(path, user_json, function (error, data) {
          if (error) throw error;
        });
      }
    });
  }
  else {
    user_json = `[{"user": "${user}", "point": 0, "wrong_answer": 1}]`
    fs.writeFile(path, user_json, function (error, data) {
      if (error) throw error;
    });
  }
}



/*==================================
 BASIC FUNCTIONS
====================================*/
function handleUrlParams(data) {
  const params = new URLSearchParams(data);
  const wid = params.get('wid');
  const type = params.get('type');
  const question_type = params.get('question_type');
  const content = params.get('content');
  return {'wid': wid, 'type': type, 'question_type': question_type, 'content': content};
}

function removeByIndex(array, index) {
  return array.filter(function (el, i) {
    return index !== i;
  });
}

function getObjectItemIndex(object, id) {
  let index;
  return index = object.findIndex(function(x) {
    return x.id === parseInt(id);
  })
}



/*==================================
 START APP AND LISTEN ON PORT
====================================*/
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
