# Selected Work

Use these four projects as separate entries at the top of Selected Work, immediately after the two opening screens. Each preview links to the fuller story and its isometric figure.

Anmol can describe the projects and what he learned. His NDAs prevent sharing demos or Git repositories. The copy uses general client descriptions and attributes qualitative outcomes to the evidence he shared. The interview notes are for the handoff. Confirm any additional client detail before using it on a public page.

## 01 · AI document assistant

**Portfolio preview**

I built a shared place for consultants to collect project knowledge and find earlier work. A case study from ten years earlier helped win a new contract.

**Case study**

A consulting team had valuable research, reports, and notes from past engagements. When several consultants and analysts worked with the same client, their insights could sit in different places. Finding out what a colleague knew often meant another round of email.

I built a document assistant around a shared client record. Team members could add what they found as they worked. The system organised that material under the relevant client so colleagues on the same project could find and use it.

In one contract meeting, a consultant brought out the case study and research from an engagement ten years earlier. The prospective client was impressed that the team could draw on that history. It helped win the contract.

**What I learned**

An assistant is only as useful as the records it can work with. Organising information as it comes in makes it easier to find and use years later.

**Interview notes**

- Early problem statement was that the team did not know what it already knew about its clients. Several consultants and analysts could be working on the same account. Each could contribute insights, with organisation handled by the system.
- Anmol explicitly agreed to say that the historic research contributed to the contract win.
- The first description used a hypothetical 500-page upload and a refund-policy question to explain document retrieval and citation. Anmol mentioned document processing, embeddings, vector databases, and retrieval-augmented generation in that overview. Confirm which details describe the real engagement before including them.
- The broader lesson was the value of clean, well-organised records across systems.

## 02 · AI voice receptionist

**Portfolio preview**

I built a shared voice receptionist for a restaurant group. Callers could ask about catering and book on the same call, and the owner reported more catering bookings.

**Case study**

Each restaurant managed its own table bookings. Catering enquiries often started with a call to the front desk, then went to the owner by email. Customers had to wait for answers before they could book, and some enquiries dropped off along the way.

I built a voice receptionist that could check availability across locations, answer common questions, and take bookings during the call. A table booking went to the front desk at the right restaurant. A confirmed catering booking went to the owner with the customer’s requirements already captured.

The group used it with real callers, including outside staffed hours. The owner reported an increase in catering bookings once customers could get answers and book in one call.

**What I learned**

A good voice interaction feels like a natural conversation. I wanted callers to spend their attention on what they were booking, with the system handling where the request went next.

**Interview notes**

- The client was a restaurateur with multiple locations in Sweden. Each location used separate third-party booking systems. Catering was handled through a back kitchen, with questions manually answered by the owner.
- The shared assistant had access to table bookings and a defined set of answers about reservations and catering. It routed confirmed requests to the staff responsible for fulfilling them.
- Anmol confirmed live use with real callers. The owner reported an increase in catering bookings with the service available around the clock. Anmol did not give a conversion figure.
- Anmol mentioned a voice-agent platform for this project and ElevenLabs for some of his current work. Confirm platform details if they matter for the case. The initial description discussed speech recognition, speech generation, tool calls, calendar integration, interruptions, and errors as voice-system capabilities. Keep the case focused on what Anmol verified about this engagement.

## 03 · AI invoice processing

**Portfolio preview**

I built an assistant that organised scattered invoices, flagged those that needed review, and prepared emails for an admin to approve.

**Case study**

A food and beverage procurement team received invoices as PDFs and photos of paper documents, some of them handwritten. Staff had to read, review, and file them by hand. The records were scattered, which made it hard to maintain a reliable invoice database.

I built an assistant that read incoming documents and filed invoices where they belonged. It flagged items that needed review and prepared emails for the people who needed each invoice. Those messages stayed in drafts until the admin reviewed and approved them.

The team spent less of its day reading and filing invoices by hand. The admin could focus on flagged items and decide when each email was ready to send.

**What I learned**

The admin’s review was part of how the system maintained quality. I designed the workflow around that judgement, with the paperwork prepared before the decision reached them.

**Interview notes**

- The client’s procurement workflow involved incoming and outgoing invoices across vendors, partners, and supply-chain managers. Some inputs were handwritten.
- The system used OCR to recognise documents, organised and processed them, and flagged those needing admin attention. The workflow connected to the team's email assistants. Drafts waited for admin approval.
- The reported impact was improved day-to-day efficiency and productivity. There is no quantified time-saving or accuracy figure in the discussion.
- Anmol sees human review as part of maintaining quality in a system, including workflows that do not use AI.

## 04 · AI research assistant

**Portfolio preview**

I built an assistant that gathered sources on request and answered from the collected material. When I tested it with a made-up claim, it told me the sources didn’t support it.

**Case study**

A team researching emerging medical devices moved between papers, case studies, and articles, then copied findings into Word documents. With sources spread across tabs and files, keeping a finding connected to its evidence took manual work.

I separated finding sources from asking questions about them. On request, the assistant searched for material and saved it with its source details. When the team asked a question, it answered from that collection and showed which sources supported its response. The team could carry those citations into its own write-ups.

I tested that boundary by introducing a made-up claim. The assistant told me it couldn’t find the claim in the collected sources. It stopped where its evidence ran out.

**What I learned**

Information and knowledge are related, but they serve different purposes. A plausible answer is one piece of information. In research, I need to see where it came from before I can rely on it.

**Interview notes**

- The design drew on the idea of discussing a collection of sources with citations. Anmol wanted explicit control over when the system gathered new material and when it worked inside an existing collection.
- The client had many tabs open and manually copied findings into Word. The assistant separated internet search on demand, saving sources and citations, and answering from the stored material.
- The made-up claim was a test Anmol performed. It supports one concrete example of the behaviour, with no broader performance claim or clinical validation.
- The original project description discussed comparing sources and flagging disagreement. Confirm what the system actually did before making those claims on the site.

## Parked fifth project · AI evaluation platform

Anmol explicitly put this on hold after the four interviews. The initial concept was to evaluate accuracy, relevance, faithfulness, hallucinations, and safety, compare models and prompts, combine model-based judgement with human-reviewed examples, and rerun tests after updates to catch regressions. Keep this as a future conversation topic outside the featured four.

The broader engineering point behind the original list was that production AI work covers data processing, retrieval, tool integration, output validation, evaluation, and handling failures. For the current portfolio, let each individual story show the part of that work Anmol actually carried out.
