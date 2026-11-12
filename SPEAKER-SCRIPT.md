# Hermes Agent 101: speaker script

A word-for-word script for the 30-minute talk, one section per slide, in the same order as the deck.

- **Slides:** https://debb1ie.github.io/Hermes-Agent-101/
- **Speaker:** Precious Grace Deborah Manucom (Debbie)
- **Length:** 34 slides, 30 minutes, about 130 spoken words per minute

**How to read this.** *What's on screen* tells you what students see. **Say** is the script; read it as written or put it in your own words. **Do** lists actions such as clicking or demoing. The minutes after each title are the time budget for that slide.

---

## Before you start (10 minutes before)

- [ ] Open the slides in Chrome and press **F** for full screen. The bottom bar appears when your mouse reaches the bottom edge.
- [ ] Keep **Hermes Desktop** open on the Bots tab, with the **Study Squad** group ready.
- [ ] Keep a **terminal** open with this already typed, so you only press Enter: `hermes -p h101-researcher -z "Name 2 free beginner courses on AI agents. One line each, with a link."`
- [ ] Open **Telegram** to the Iris chat, `@hermes101_iris_bot`.
- [ ] Check that Hermes is running: `hermes status`.
- [ ] **Turn the cat off (C)** if you want a serious crowd. Leave it on if you want laughs.

---

## Slide 1 · Hermes Agent 101 (0:30)

*On screen: the Hermes logo, the title, your name.*

**Say:**
"Hi everyone, I'm Debbie. Today we're going to set up a real AI agent: not just a chatbot, but one that can search, remember you, and work on its own. Every screenshot you'll see comes from Hermes itself, running on my computer. Thirty minutes, and I promise there's a demo at the end."

---

## Slide 2 · Coding with an AI that forgets everything (0:30)

*On screen: the sweaty-gamer meme video, playing silently.*

**Say:**
"Quick show of hands: who has explained their whole project to an AI, then opened a new chat and had to explain it all again? Yeah. That's this guy. Every chat starts from zero, and it repeats the mistake you fixed yesterday. Hermes fixes that: it keeps memory about you and saves skills for what worked. Keep that in mind; it's the theme of today."

---

## Slide 3 · Four stops to your own working agent (0:30)

*On screen: a route with four stops and a bar showing how the time splits.*

**Say:**
"Here's our route. First, meet Hermes: what an agent actually is. Second, set it up. Third, the big one: make your own agent and make it safe. Fourth, I'll show you the agents running this course, and we'll do a live demo. The finish line is you, with your own working agent."

---

## Slide 4 · A chatbot answers. An agent acts. (1:00)

*On screen: a one-shot chatbot strip, and the agent loop: Think, Act, Look, Done?*

**Say:**
"A chatbot answers from memory, one shot, no tools. An agent works in a loop. Look at the circle: the goal is 'find three free AI courses.' It thinks, 'I need current info.' It acts: it calls a tool, a web search. It looks at the results: five results, one is old. Is it done? No, go around again. Yes, give the answer, with links.

Same model, different loop. Two things to remember. Every loop costs tokens, so a five-step task can cost more than a long essay. And mistakes become actions: a wrong answer is just text, but a wrong tool call changes things. That's why the rest of this talk is about tools and settings."

---

## Slide 5 · Hermes Agent, by Nous Research (1:00)

*On screen: the official Hermes website, and a QR code.*

**Say:**
"Hermes Agent is made by Nous Research. Their tagline is 'The agent that grows with you.' Three things I love about it. It's open source, MIT license, so you can read exactly what it does with your data. It's model-agnostic: you can swap the brain, the AI model, without rebuilding your agent. And it's local-first: your chats, memory, and skills are plain files on your own computer. Scan the QR if you want the official site."

**Do:** pause about 5 seconds for people to scan.

---

## Slide 6 · Six things that make it more than a chatbot (1:00)

*On screen: six cards with small pictures.*

**Say:**
"Six things Hermes adds. **Tools**, with switches: web search can be on in your terminal but off on Telegram. **Memory**: two small notes files about you, small on purpose. **Skills**: when something works, it saves the method as a file and reuses it. **Schedule**: it can wake up at 8 AM and do a job with nobody typing. **Messaging**: one gateway connects Telegram, Discord, Slack, WhatsApp. And **profiles**: many separate agents on one install. Atlas, Forge, and Iris here are three of ours."

---

## Slide 7 · "I can already make a Telegram bot. Why Hermes?" (1:00)

*On screen: a comparison table, a plain bot vs. Hermes on Telegram.*

**Say:**
"Someone always asks this, so let's answer it now. When you make a bot with BotFather, you get an empty account: a name and a token. No brain. Every reply is code you still have to write.

Hermes is the agent behind the bot. Look at the table. Brain: any AI model. Memory: it remembers you between chats. Actions: web search, vision, files, code, whatever you choose. It works on its own with scheduled jobs. Safety is built in: pairing, allowlists, approvals. And it saves skills that worked.

Honest answer: if you only need a fixed menu bot, 'press 1 for schedule,' a plain bot is simpler. If you want a helper that thinks, remembers, and acts, use Hermes. In one line: the Telegram bot is the phone line. Hermes is who answers."

---

## Slide 8 · Meme break: "API key, provider, model, gateway" (0:15)

*On screen: the confused-math meme.*

**Say:**
"This is you hearing 'API key, provider, model, gateway' for the first time. Relax. In the app, it's four screens."

---

## Slide 9 · What you need before you start (1:00)

*On screen: a requirements table.*

**Say:**
"What you need. The desktop app works on Macs with Apple Silicon, M1 or newer, and on Windows 11. Everyone else, including Intel Macs and Linux, uses one terminal command. Easy check on a Mac: About This Mac. If it says 'Apple M-something,' the app works.

It needs about 4 GB, and it brings its own Python, so your Python setup doesn't matter. And the model can be free: Nous Portal has a free tier with no API key at all. Last thing: install it on your own computer, or ask the owner first."

---

## Slide 10 · Install once, in two screens (1:00)

*On screen: Hermes Desktop's first screen and the installer.*

**Say:**
"Download the app from the official site and open it. The first screen asks two things. Pick 'Install Hermes locally'; 'Connect' is only if Hermes already runs on another computer. Then it runs a one-time setup, about nine steps. It's slow once and fast forever. And the app and the terminal share the same folder, so you can switch between them any time. No app? That one line at the bottom does the same thing."

---

## Slide 11 · Connect a model: the agent's brain (1:00)

*On screen: choosing a provider, and pasting an API key.*

**Say:**
"Next, the brain. Nous Portal is the easiest. Or click 'I have an API key', pick a provider like OpenRouter, click 'Get a key', paste it, and Connect.

Three warnings. The key is a password: it lives in a hidden file called `.env`, and it never goes in a chat, a screenshot, or GitHub. A key only fits its own provider; an OpenAI key won't work on OpenRouter. And free models have limits: if you see error 429, it means 'wait a bit', not 'broken'. For this course we used a free NVIDIA model through OpenRouter."

---

## Slide 12 · Check that it works (1:00)

*On screen: `hermes --version` and `hermes doctor` in the terminal.*

**Say:**
"Two commands to remember. `hermes --version` tells you it's installed. `hermes doctor` checks your files, your key, and your folders. Green check marks mean OK; warnings are just optional extras. My rule: doctor first, questions second. And if the terminal says 'command not found', you probably opened that terminal before the install finished. Just open a new one."

---

## Slide 13 · Say hi, then say exactly what you want (1:00)

*On screen: the Hermes Desktop home screen and a one-line terminal chat.*

**Say:**
"Now say hi, in the app or the terminal. Three tips. Type `/new` when you finish a task: that starts a fresh chat, and it's also when memory gets saved. The `-z` option asks one question and prints only the answer, but it skips approvals, so only use it with safe tools. And ask for a format. 'One line each, with a link' gets a way better answer than 'tell me about…'."

---

## Slide 14 · Meme break: the master plan (0:15)

*On screen: the whiteboard-guy meme.*

**Say:**
"Part 3. This is me explaining my agent's master plan: profile, SOUL.md, tools, safety, memory, jobs, Telegram. Don't worry, we'll go one by one."

---

## Slide 15 · Your whole agent is one folder (1:00)

*On screen: the folder layout and the real folder of our research agent.*

**Say:**
"Everything your agent knows lives in one folder, `~/.hermes`. `config.yaml` holds the settings. `.env` holds the secrets. `SOUL.md` says who the agent is. Then come memories, skills, and scheduled jobs. So a backup is just copying one folder. And `.env` is hidden because its name starts with a dot. It's the one file you never share."

---

## Slide 16 · One profile = one agent = one job (1:00)

*On screen: the commands to create a profile, and `hermes profile show`.*

**Say:**
"A profile is a separate agent. `hermes profile create study-buddy` and you have a new one. Each profile has its own settings, memory, and keys, so your study buddy can't read your coder's memory. One gateway serves all of them, each at its own address. And adding `-p` plus a name to any command aims it at that one agent."

---

## Slide 17 · Your agents, side by side (1:00)

*On screen: the Bots tab, and the New group chat dialog.*

**Say:**
"In the app, every profile becomes a bot, with its own face and its own chat. Here are Atlas, Forge, and Iris. You can put two to six of them in a group chat. Each one keeps its own SOUL.md, tools, and memory, even inside the group. Pick the ones whose jobs fit the task. Here I'm making a 'Study Squad'."

---

## Slide 18 · A study group of agents (1:30)

*On screen: the real Study Squad group chat.*

**Say:**
"This is real. I asked the group once, with `@everyone`: 'I have a Data Structures exam on Friday about trees.' Atlas, the researcher, found a free freeCodeCamp guide. Forge, the coder, gave a practice exercise with the answer, then LeetCode links. And look: they hand off on their own. 'At Iris, your turn.' Iris even replied to Forge by name.

`@everyone` reaches all of them; `@name` reaches one. One warning: every reply costs tokens, so three bots means about three times the usage."

---

## Slide 19 · SOUL.md: who your agent is (1:00)

*On screen: a short SOUL.md example and our research agent's real SOUL.md.*

**Say:**
"SOUL.md is a short text file that tells the agent who it is: its job, its rules, what it must never do, and its tone. Hermes reads it at the start of every chat, so edit it, type `/new`, and you'll see the change. Short beats long: ten clear lines work better than a page.

But here's the important part: a rule in SOUL.md is only a request. A tricky web page can talk the agent out of it. That's why the next two slides exist."

---

## Slide 20 · Every tool is a door (1:00)

*On screen: the Tools switches in the app, and `hermes tools list` in the terminal.*

**Say:**
"Tools let the agent act, and every tool is a door. Give it only what its job needs; that's called least privilege. A news bot needs web search, not your files.

The risky four are terminal, files, browser, and code execution. Tools are set per platform, so Telegram can have fewer than your terminal. Our research agent has only web search and vision. Everything risky is off. And changes apply to new chats, not the one you're in."

---

## Slide 21 · A rule is a request. A setting is a lock. (1:30)

*On screen: Settings › Safety › Approvals, and three settings.*

**Say:**
"This is my favorite slide. Telling an agent 'never run risky commands' is a request. A setting is a lock, because Hermes itself enforces it, even when the agent is fooled.

Three locks. Approval mode set to manual: risky commands wait for your yes. `deny`: a command on that list can never run, even if someone clicks approve. And `max_turns`: a hard limit on steps, which is basically your cost cap, because it stops loops before they burn your credits. If you remember one thing today: put safety in settings, not just in words."

---

## Slide 22 · It remembers you, and learns how-tos (1:00)

*On screen: the Memory and Skills settings in the app.*

**Say:**
"Memory is two tiny files: one about the agent's own notes, one about you. They're tiny on purpose, about 3,500 characters total, so only what matters is kept. Tell it 'remember that I like short answers,' and it's saved when you type `/new`, not in the middle of a chat.

Skills are saved how-tos. There's a Skills Hub with thousands of them. But a skill is instructions your agent will follow, so read one before you install it."

---

## Slide 23 · It works while you sleep (1:00)

*On screen: the New cron job form in the app, and Iris's real scheduled jobs.*

**Say:**
"Scheduled jobs, called cron jobs, are an alarm clock for your agent. Pick a blueprint like Morning briefing, set a time, and choose where to send it. On the right are our Iris's real jobs and their last runs.

Two notes. The schedule `0 8 * * 1-5` means weekdays at 8:00. And the job runs inside Hermes on your computer, so if your laptop is asleep, the job is skipped. Deliver it to Telegram so it reaches your phone."

---

## Slide 24 · Meme break: 8 AM (0:15)

*On screen: the cool dog in a hoodie.*

**Say:**
"Me at 8 AM, because my agent already sent the morning briefing. That's the dream."

---

## Slide 25 · Your agent, on your phone (1:00)

*On screen: Create with QR, a pairing code, and Iris answering, all real Telegram screenshots.*

**Say:**
"Telegram. In the app, click 'Create with QR', scan it, confirm in Telegram, and Hermes creates the bot and finds your user ID for you.

Then look at the middle: when a stranger presses Start, they don't get answers. They get a pairing code, valid for one hour, and nobody gets answers until you approve them. After approval, on the right, Iris answers. And remember: Hermes still runs on your computer. Telegram only carries the messages."

---

## Slide 26 · Any app can talk to your agent (1:00)

*On screen: the API server setting, and a real API call with its answer.*

**Say:**
"Hermes speaks the same language as the OpenAI API. So any app built for OpenAI can use your agent by changing one web address. Each profile gets its own address. That's exactly how our course website talks to its agents. Keep it on your own computer, and if you ever open it to the internet, do it through one guarded door. Next slide, you'll see ours."

---

## Slide 27 · Real Hermes agents power this course (1:00)

*On screen: Atlas, Forge, Iris, and the SOUL.md tester.*

**Say:**
"We followed our own rules. Four agents, one job each. Atlas, the researcher, answers with sources. Forge, the coder, writes and explains code but can't run it. Iris, the assistant, plans, runs daily jobs, and lives on Telegram. And the SOUL.md tester acts out the SOUL.md a student writes, with no tools at all.

None of them has terminal or file access. So even if someone tricks one, the worst it can do is search the web."

---

## Slide 28 · Ask a real agent (0:45)

*On screen: a real terminal answer from Atlas.*

**Say:**
"One question to Atlas in the terminal: 'two free beginner courses on AI agents, with links.' It searched the web and answered with sources. You don't see the searches because `-z` shows only the answer, but they happened. Always open the links: models can invent URLs that look real."

---

## Slide 29 · One website, one door to Hermes (0:45)

*On screen: browser → website → edge → Hermes → AI model.*

**Say:**
"How the course website connects. Your browser talks only to the website. The website holds the keys, so they never reach your browser, and it calls Hermes through one small edge server. That's the only door in, and it's an allowlist: it lets through only the course agents and refuses everything else. And if you close the page, the Hermes run is cancelled."

---

## Slide 30 · Not a mock-up: Hermes's own reports (0:45)

*On screen: `hermes insights` for Atlas and for Iris.*

**Say:**
"Proof that this is real. These reports come from Hermes itself. Atlas's report shows real web search calls. Iris's report shows 'cron' sessions: jobs that ran with nobody typing."

---

## Slide 31 · Let's run it (1:30)

*On screen: five demo steps.*

**Do (in this order):**
1. **Terminal first** (it takes about 10 seconds): press Enter on the Atlas question you typed earlier.
2. **Desktop:** Capabilities › Tools. Turn one tool off and back on.
3. **Desktop:** Settings › Safety. Show Approval Mode.
4. **Desktop:** Bots › Study Squad. Ask `@everyone` a short question.
5. **Back to the terminal:** show Atlas's answer.
6. **Telegram:** say hi to Iris.

**Say while it loads:**
"I'm starting Atlas first, because free models take 8 to 15 seconds. That's normal: it's thinking and searching. While it works, here's the tools switch… here's approval mode… and here's the Study Squad."

**If the Wi-Fi fails:** "Every step has a slide with the real screen." Press **O** and jump back to slides 18, 20, 21, or 25.

---

## Slide 32 · Meme break: it worked (0:15)

*On screen: the slow-clap meme.*

**Say:**
"When the live demo actually works. Thank you, free model. Thank you, Wi-Fi."

---

## Slide 33 · Six rules to take home (0:45)

*On screen: six rules, each with a small picture.*

**Say:**
"Six rules to take home. Keys are passwords: never share them. Fewest tools: every tool is a door. Settings, not wishes: approvals, step limits, allowlists. Check the answer: open the sources. Protect people: no one else's phone number or private messages. And learn, don't copy: use agents to understand, not to hand in work as yours.

An agent works for you, and you are responsible for what it does."

---

## Slide 34 · Thank you (1:00)

*On screen: the install command and QR codes for the slides, the manual, and the official site.*

**Say:**
"That's it! Scan the codes: these slides, the student manual with every step and command, and the official Hermes site. The install is one line, right there. Thank you. Questions?"

**Do:** stay on this slide during questions so people can scan.

---

## Ready answers for questions

**"Is it free?"**
"Hermes is free and open source. You only pay for the AI model, and you can start free with the Nous Portal free tier or a free OpenRouter model."

**"Is my data safe? Where does it go?"**
"Your chats, memory, and skills stay on your computer in `~/.hermes`. Messages go only to the model provider you choose. Hermes itself doesn't collect your data."

**"I can already make a Telegram bot. Why Hermes pa?"**
"A BotFather bot is an empty account; every reply is code you write. Hermes is the brain behind it: any AI model, memory, tools, scheduled jobs, and safety built in, and the same agent works on Discord, Slack, and the terminal too. For a simple menu bot, a plain bot is fine. For a helper that thinks and acts, use Hermes."

**"Can it run without internet?"**
"Yes, with a local model like Ollama. It needs a strong computer, but nothing leaves your machine."

**"My laptop is an Intel Mac / Windows 10. Can I use it?"**
"Not the desktop app, but the terminal install works. It's one command; it's in the manual."

**"What if the agent does something wrong?"**
"That's why we use settings: approvals make risky commands wait for you, `deny` blocks dangerous ones completely, and `max_turns` stops runaway loops. Press Ctrl+C to stop a chat, or `hermes pause` to stop everything."

**"Can I use it for my school projects?"**
"Yes, to learn, plan, and understand. Not to hand in work as your own. Follow your school's rules."
