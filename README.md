# **Lexport AI** 🤖
Empowering Malaysian SMEs with AI-driven export compliance solutions. 🌍✈️

## 🏆 Hello, Judges! 🌟
Thank you for considering Lexport AI. We are proud to present a *mission-critical* compliance tool built with cutting-edge Bedrock and Titan technology, directly solving a major bottleneck for Malaysian SMEs aiming for global expansion. Our innovation is centered on turning complex legal compliance into a fast, reliable, and actionable process, demonstrating powerful real-world application of the RAG architecture.

## ✨ Key Features

* **✅ One Source:** Centralized and continuously updated repository of export/import regulations. 📚
* **💬 One Language:** AI-powered transformation of complex legal jargon into clear, accessible explanations. 🗣️
* **🗺️ One Roadmap:** Actionable, step-by-step compliance instructions with direct references to laws. 🧭
* **⏱️ Cost and Time Efficiency:** Provides SMEs with answers in seconds, reducing reliance on consultants. 💰
* **📜 Credibility:** Every response is backed by citations from official regulations. ⚖️
* **🤖 Smart AI assistant chatbot (Legal-Bot):** Uses a Retrieval-Augmented Generation (RAG) pipeline with Amazon Nova Lite. 🧠
* **🧠 Semantic Understanding:** Utilizes Amazon Titan Text Embeddings v2 for contextual search. 🔎

## 🧠 Skills & Tech Stack

### 🧑‍💻 Front-End
* Typescript, React, HTML, Javascript

### ☁️ Cloud & AI
* Bedrock, Amazon titan Text Embeddings v2, Amazon Nova Lite, Amazon S3 Vector Bucket, Python, Javascript

## 🧩 System Design & Architecture
Our system follows a Retrieval-Augmented Generation (RAG) pipeline to deliver accurate, plain-language export compliance guidance to SMEs.
<img src="Architecture-Diagram/image.jpg" />

### 🏗️ Application Design using RAG Architecture

**How the Architecture Works:**

1.  **User Query:** An SME user enters a natural language question (e.g., "Can I export skincare cream to Singapore?"). 💬
2.  **Embedding and Retrieval:** The query is converted into an embedding using Amazon Titan Text Embeddings v2. A similarity search is performed against pre-computed embeddings of legal documents stored in an Amazon S3 vector bucket. The system retrieves the most relevant law/regulation chunks to provide accurate legal context. 📂
3.  **LLM Reasoning with Amazon Nova Lite:** The retrieved legal text is passed to Amazon Nova Lite, which is instructed to generate a response that combines legal accuracy (citations) with practical usability (action steps, permits required, HS code suggestions). 💡
4.  **Result Delivery:** The AI returns a final JSON answer including item classification, HS code, estimated fees, taxes, required permits, limitations, and legal sources. 📈

---

## 🚀 Explore Our Products
* **Watch the Full Demonstration:** See the RAG pipeline in action, turning a natural language query into a fully-cited, actionable compliance roadmap in seconds: [Full Demo Video](https://www.youtube.com/watch?v=KJgQoqapFkc)
* *Interested in the Live Platform?* Connect with the Lexport AI team for a personalized walk-through to see the full scope of our centralized, intelligent compliance solution. 🤝
