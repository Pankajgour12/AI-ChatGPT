// const { socket } = require("socket.io");


(function(){
  // Elements
  const newChatBtn = document.getElementById('newChatBtn');
  const conversationsList = document.getElementById('conversationsList');
  const messagesWrap = document.getElementById('messagesWrap');
  const composer = document.getElementById('composer');
  const messageInput = document.getElementById('messageInput');
  const currentTitle = document.getElementById('currentTitle');
  const menuToggle = document.getElementById('menuToggle');
  const emptyState = document.getElementById('emptyState');
  const clearBtn = document.getElementById('clearBtn');
  const SEARCH_INPUT = document.getElementById('searchConv');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const deleteAllBtn = document.getElementById('deleteAllBtn');

  // Storage key
  const STORAGE_KEY = 'chat_app_conversations_v1';
  const THEME_KEY = 'chat_app_theme_v1';

  // State
  let conversations = [];
  let activeId = null;
  let showArchived = false;

  // Helpers
  function uid(){ return Math.random().toString(36).slice(2,9) }
  function nowTs(){ return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }

  // Load & save
  function load(){ 
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      conversations = raw ? JSON.parse(raw) : [];
    }catch(e){ conversations = [] }
    if(conversations.length) activeId = conversations[0].id;
  }
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)) }

  // Load theme
  function loadTheme(){
    try{
      const t = localStorage.getItem(THEME_KEY);
      if(t === 'dark') document.body.classList.add('dark-theme');
    }catch(e){}
  }
  function saveTheme(dark){
    try{ localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light') }catch(e){}
  }

  // Render conversations list (updated to include delete button)
  function renderConversations(filter=''){
    conversationsList.innerHTML = '';
    const list = conversations.filter(c => {
      const titleMatch = c.title.toLowerCase().includes(filter.toLowerCase());
      return titleMatch && (showArchived ? true : !c.archived);
    });
    list.forEach(conv=>{
      const el = document.createElement('div');
      el.className = 'conv-item' + (conv.id === activeId ? ' active' : '') + (conv.archived ? ' archived' : '');
      el.dataset.id = conv.id;

      // include left icon + content wrapper so CSS ellipsis works
      el.innerHTML = `
        <style>
          /* layout helpers */
          .conv-item{ display:flex; align-items:center; gap:8px; padding:6px 8px; }
          .conv-main{ flex:1; min-width:0; }

          /* time: visible by default, hide when item hovered */
          .conv-time{
        font-size:0.8rem;
        color:var(--muted);
        margin-left:8px;
        white-space:nowrap;
        transition: opacity .18s ease, transform .18s ease;
        opacity:1;
        transform:translateX(0);
          }
          .conv-item:hover .conv-time{
        opacity:0;
        transform:translateX(6px);
        pointer-events:none;
          }

          /* three-dot control: hidden by default, appear on hover with smooth transition */
          .conv-delete{
        opacity:0;
        transition: opacity .12s ease, transform .12s ease;
        transform:scale(.95);
        margin-left:6px;
          }
          /* place popover controls absolutely so they don't shift layout */
          .conv-item{ position:relative; }

          /* reserve space on the right so title/preview never jump under controls */
          .conv-main{ padding-right:84px; }

          /* time: absolute, vertically centered; fades out on hover without moving layout */
          .conv-time{
            position:absolute;
            right:12px;
            top:50%;
            transform:translateY(-50%);
            font-size:0.8rem;
            color:var(--muted);
            white-space:nowrap;
            transition: opacity .18s ease, transform .18s ease;
            opacity:1;
            pointer-events:none;
          }
          .conv-item:hover .conv-time{
            opacity:0;
            transform:translateY(-50%) translateX(6px);
          }

          /* three-dot control: sit in the same spot as the time, hidden by default */
          .conv-delete{
            position:absolute;
            right:8px;
            top:50%;
            transform:translateY(-50%) scale(.95);
            opacity:0;
            transition: opacity .12s ease, transform .12s ease;
            margin-left:0;
            z-index:10;
            background:transparent;
            border:0;
            padding:6px;
            border-radius:50%;
            cursor:pointer;
          }

          /* show the three-dot when the item is hovered (or when the control itself gets focus) */
          .conv-item:hover .conv-delete,
          .conv-delete:focus{
            opacity:1;
            transform:translateY(-50%) scale(1);
          }

          /* subtle pop on the control itself */
          .conv-delete:hover{
            transform:translateY(-50%) scale(1.08);
          }

          /* keep main content stable */
          .conv-main{ opacity:1; transition:opacity .12s ease; }
          }
          /* subtle hover "pop" on the three-dot itself */
          .conv-delete:hover{
        transform:scale(1.08);
          }

          /* keep main content opacity steady */
          .conv-main{ opacity:1; transition:opacity .12s ease; }
        </style>

        <div class="conv-main" style="flex:1">
          <div class="title">${escapeHtml(conv.title)}</div>
          <div class="preview">${escapeHtml((conv.messages.slice(-1)[0]||{content:''}).content.slice(0,80))}</div>
        </div>

        <div class="conv-time">${conv.updatedAt||''}</div>
      `;

      // select on click
      el.addEventListener('click', ()=> selectConversation(conv.id));

      // three-dot control (styled as circular control) - shows options popover
      const del = document.createElement('button');
      del.className = 'conv-delete';
      del.title = 'Options';
      del.setAttribute('aria-label', 'Conversation options');
      del.innerHTML = '⋯'; // three dots like ChatGPT

      // open popover on click - use document.body append + positioning to avoid clipping
      del.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        // close existing popovers
        closeAllPopovers();

        // build popover element
        const pop = document.createElement('div');
        pop.className = 'menu-popover';
        pop.id = 'popover-'+conv.id;
        pop.setAttribute('role','menu');
        pop.setAttribute('aria-hidden','false');

        const makeBtn = (text, cls) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = text;
          if(cls) b.className = cls;
          return b;
        };

        const renameBtn = makeBtn('Rename');
        renameBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const newTitle = prompt('Rename conversation', conv.title);
          if(newTitle !== null){
            conv.title = newTitle.trim() || conv.title;
            conv.updatedAt = nowTs();
            save();
            renderConversations(SEARCH_INPUT.value || '');
            updateHeader();
            pop.remove();
          }
        });
        pop.appendChild(renameBtn);

        const archBtn = makeBtn(conv.archived ? 'Unarchive' : 'Archive');
        archBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          conv.archived = !conv.archived;
          conv.updatedAt = nowTs();
          save();
          renderConversations(SEARCH_INPUT.value || '');
          pop.remove();
          if(conv.archived && activeId === conv.id){
            activeId = conversations.find(c=>!c.archived)?.id || null;
            renderMessages();
            updateHeader();
          }
        });
        pop.appendChild(archBtn);

        const shareBtn = makeBtn('Share');
        shareBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const text = `Conversation: ${conv.title}\n\n` + conv.messages.map(m=>`${m.role}: ${m.content}`).join('\n\n');
          navigator.clipboard?.writeText(text).then(()=> {
            alert('Conversation copied to clipboard');
          }).catch(()=> alert('Copy failed'));
          pop.remove();
        });
        pop.appendChild(shareBtn);

        const deleteBtn = makeBtn('Delete', 'danger');
        deleteBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          if(confirm('Delete this conversation?')){ deleteConversation(conv.id); }
          pop.remove();
        });
        pop.appendChild(deleteBtn);

        // append popover to body and position it near the button
        document.body.appendChild(pop);
        positionPopover(pop, del);
      });

      el.appendChild(del);
      conversationsList.appendChild(el);
    });
  }

  // Escape small HTML
  function escapeHtml(s=''){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

  // Create new conversation
  function createConversation(title){
    const id = uid();
    const conv = { id, title: title||'New Chat', messages: [], createdAt: new Date().toISOString(), updatedAt: nowTs() };
    conversations.unshift(conv);
    activeId = id;
    save();
    renderConversations();
    renderMessages();
    updateHeader();
    // ensure sidebar closed on mobile
    document.body.classList.remove('show-sidebar');
  }

  // Select conversation
  function selectConversation(id){
    activeId = id;
    renderConversations(SEARCH_INPUT.value || '');
    renderMessages();
    updateHeader();
    // close sidebar on mobile for better UX
    document.body.classList.remove('show-sidebar');
  }

  // Update header title
  function updateHeader(){
    const conv = conversations.find(c=>c.id===activeId);
    currentTitle.textContent = conv ? conv.title : 'New chat';
  }

  // helper: check if user is near bottom of messages (so we can auto-scroll)
  function isAtBottom(threshold = 140){
    if(!messagesWrap) return true;
    return (messagesWrap.scrollHeight - messagesWrap.scrollTop - messagesWrap.clientHeight) < threshold;
  }

  function scrollToBottom(){
    requestAnimationFrame(()=> {
      messagesWrap.scrollTop = messagesWrap.scrollHeight;
    });
  }

  // Render messages (updated to smart-scroll; forceScroll forces scroll to bottom)
  function renderMessages(forceScroll = false){
    const wasAtBottom = isAtBottom();
    messagesWrap.innerHTML = '';
    const conv = conversations.find(c=>c.id===activeId);
    if(!conv || !conv.messages.length){
      if(emptyState) messagesWrap.appendChild(emptyState);
      if(forceScroll || wasAtBottom) scrollToBottom();
      return;
    }

    conv.messages.forEach((m, i)=>{
      const row = document.createElement('div');
      row.className = 'msg-row ' + (m.role === 'user' ? 'me' : 'assistant');

      if(m.role === 'assistant'){
        const av = document.createElement('div'); av.className = 'avatar'; av.textContent = 'AI';
        row.appendChild(av);
      }

      const bubble = document.createElement('div');
      bubble.className = 'msg ' + (m.role === 'user' ? 'user' : 'assistant');

      // message content and meta
      bubble.innerHTML = `<div class="body">${escapeHtml(m.content)}</div><span class="meta">${m.ts||''}</span>`;

      // actions container (copy/delete)
      const actions = document.createElement('div');
      actions.className = 'actions';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'action-btn';
      copyBtn.title = 'Copy';
      copyBtn.innerHTML = '📋';
      copyBtn.addEventListener('click', (e)=>{ e.stopPropagation(); navigator.clipboard?.writeText(m.content).catch(()=>{}); });
      const delBtn = document.createElement('button');
      delBtn.className = 'action-btn';
      delBtn.title = 'Delete message';
      delBtn.innerHTML = '🗑';
      delBtn.addEventListener('click', (e)=>{ e.stopPropagation(); if(confirm('Delete this message?')) deleteMessage(i); });

      actions.appendChild(copyBtn);
      actions.appendChild(delBtn);
      bubble.appendChild(actions);

      row.appendChild(bubble);
      messagesWrap.appendChild(row);
    });

    // smart auto-scroll: if user was near bottom or forceScroll requested, scroll down
    if(forceScroll || wasAtBottom) scrollToBottom();
  }










  // Add message to current conversation (forceScroll true for user's messages)
  function addMessage(role, content, forceScroll = false){
    const conv = conversations.find(c=>c.id===activeId);
    if(!conv) return;
    const msg = { role: role==='user' ? 'user' : 'assistant', content, ts: nowTs() };
    conv.messages.push(msg);
    conv.updatedAt = nowTs();
    save();
    renderConversations();
    renderMessages(forceScroll);
  }
  

// ye function chat gpt se banaya
function sendMessage(text){
  
    if(!text || !text.trim()) return;

    // if no conversation, create one
    if(!activeId) createConversation('New chat');

    // Add user message locally
    addMessage('user', text.trim(), true);
    messageInput.value = '';

       showTyping(false);

    // emit to backend
    socket.emit('userMessage', text.trim());
}












  // Simulate assistant reply (with typing) - preserve user's scroll if they scrolled up
  // function simulateReply(userText){
  //   const wasAtBottomBeforeTyping = isAtBottom();
  //   showTyping(true);
  //   if(wasAtBottomBeforeTyping) scrollToBottom();
  //   addMessage('assistant', reply, wasAtBottomBeforeTyping);

  //   // setTimeout(()=>{
  //   //    showTyping(false);





  //   //   let reply ='not showing';;// isme kuch krna ho ho sakta he 
  //   //    const t = (userText||'').toLowerCase();
  //   //    if(t.includes('hi')||t.includes('hello')) reply = 'Hello! How can I help you today?';
  //   //    else if(t.includes('time')) reply = 'It\'s ' + nowTs() + '.';
  //   //    addMessage('assistant', reply, wasAtBottomBeforeTyping);
  //   //  }, 700 + Math.random()*900);
  



  
  // }

  // Show typing indicator respects user scroll state
  function showTyping(show){
    // remove existing typing node
    const existing = document.getElementById('typingIndicator');
    if(existing) existing.remove();
    if(!show) return;
    const wasAtBottom = isAtBottom();
    const row = document.createElement('div');
    row.id = 'typingIndicator';
    row.className = 'msg-row incoming';
    const av = document.createElement('div'); av.className='avatar'; av.textContent='AI';
    const bubble = document.createElement('div'); bubble.className='msg assistant';
    bubble.innerHTML = `<div class="typing"><div class="dots"><span></span><span></span><span></span></div></div>`;
    row.appendChild(av); row.appendChild(bubble);
    messagesWrap.appendChild(row);
    if(wasAtBottom) scrollToBottom();
  }





  
  //  Send user message
  //  function sendMessage(text){
  //  socket.emit('userMessage', text.trim());
  //    if(!text || !text.trim()) return;
  //    // if no conversation, create one
  //    if(!activeId) createConversation('New chat');
  //    // force scroll to bottom when user sends
  //    addMessage('user', text.trim(), true);
  //    messageInput.value = '';
  //    sendMessage(text);
  //  }

  // Clear conversation messages
  function clearConversation(){
    const conv = conversations.find(c=>c.id===activeId);
    if(!conv) return;
    conv.messages = [];
    conv.updatedAt = nowTs();
    save();
    renderConversations();
    renderMessages();
  }

  // Delete conversation by id
  function deleteConversation(id){
    const idx = conversations.findIndex(c=>c.id===id);
    if(idx === -1) return;
    conversations.splice(idx,1);
    // choose new active
    if(activeId === id){
      activeId = conversations.length ? conversations[0].id : null;
    }
    save();
    renderConversations(SEARCH_INPUT.value || '');
    renderMessages();
    updateHeader();
  }

  // Delete message by index in current conversation
  function deleteMessage(index){
    const conv = conversations.find(c=>c.id===activeId);
    if(!conv) return;
    if(index < 0 || index >= conv.messages.length) return;
    conv.messages.splice(index,1);
    conv.updatedAt = nowTs();
    save();
    renderConversations();
    renderMessages();
  }

  // Delete all conversations (confirmation + persistence)
  function deleteAllConversations(){
    if(!confirm('Delete ALL conversations? This cannot be undone.')) return;
    conversations = [];
    activeId = null;
    save();
    renderConversations();
    renderMessages();
    updateHeader();
  }

  // helper to position popover near button and clamp to viewport
  function positionPopover(pop, button){
    // initially hide to measure
    pop.style.visibility = 'hidden';
    pop.style.left = '0px';
    pop.style.top = '0px';
    pop.style.position = 'absolute';
    pop.style.zIndex = 9999;

    // allow browser to render then measure
    requestAnimationFrame(()=>{
      const btnRect = button.getBoundingClientRect();
      const popRect = pop.getBoundingClientRect();
      const margin = 8;
      let left = btnRect.right + margin;
      let top = btnRect.top + window.scrollY - (popRect.height/2) + (btnRect.height/2);

      // if pop goes off right edge, place it to the left of the button
      if(left + popRect.width > window.scrollX + window.innerWidth - 8){
        left = btnRect.left + window.scrollX - popRect.width - margin;
      }
      // clamp top
      if(top < window.scrollY + 8) top = window.scrollY + 8;
      if(top + popRect.height > window.scrollY + window.innerHeight - 8) {
        top = window.scrollY + window.innerHeight - popRect.height - 8;
      }

      pop.style.left = `${Math.max(8, left)}px`;
      pop.style.top = `${top}px`;
      pop.style.visibility = 'visible';
    });
  }

  // close popovers helper
  function closeAllPopovers(){
    document.querySelectorAll('.menu-popover').forEach(n=>n.remove());
  }

  // Show archived toggle handler
  const showArchivedBtn = document.getElementById('showArchivedBtn');
  if(showArchivedBtn){
    showArchivedBtn.addEventListener('click', ()=>{
      showArchived = !showArchived;
      showArchivedBtn.setAttribute('aria-pressed', showArchived ? 'true' : 'false');
      showArchivedBtn.style.opacity = showArchived ? '1' : '0.8';
      renderConversations(SEARCH_INPUT.value || '');
    });
  }

  // Theme toggle
  const themeToggleBtn = document.getElementById('themeToggle');
  if(themeToggleBtn){
    themeToggleBtn.addEventListener('click', ()=>{
      const dark = document.body.classList.toggle('dark-theme');
      saveTheme(dark);
    });
    loadTheme();
  }

  // close popovers on outside click - ensure clicks on conv-delete don't close immediately (handled)
  document.addEventListener('click', (e)=>{
    if(!e.target.closest('.menu-popover') && !e.target.closest('.conv-delete')){
      closeAllPopovers();
    }
  });

  // Events
  newChatBtn.addEventListener('click', ()=> createConversation('New chat'));
  composer.addEventListener('submit', (e)=>{
    e.preventDefault();
    sendMessage(messageInput.value);
  });
  messageInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault(); sendMessage(messageInput.value);
    }
  });
  menuToggle && menuToggle.addEventListener('click', ()=> {
    document.body.classList.toggle('show-sidebar');
  });

  // overlay click closes sidebar (mobile)
  if(sidebarOverlay){
    sidebarOverlay.addEventListener('click', ()=>{
      document.body.classList.remove('show-sidebar');
      // close any popovers when sidebar closed
      closeAllPopovers();
    });
  }

  // close sidebar button (mobile)
  if(closeSidebarBtn){
    closeSidebarBtn.addEventListener('click', ()=>{
      document.body.classList.remove('show-sidebar');
    });
  }

  // delete all conversations
  if(deleteAllBtn){
    deleteAllBtn.addEventListener('click', ()=>{
      deleteAllConversations();
    });
  }

  // When the input gets focus on mobile, ensure the conversation scrolls to bottom after keyboard appears
  messageInput && messageInput.addEventListener('focus', ()=>{
    // small delay so mobile keyboard can open then scroll
    setTimeout(()=> scrollToBottom(), 300);
  });
  messageInput && messageInput.addEventListener('blur', ()=>{
    // optional: small delay remove any transient behavior
    setTimeout(()=> {}, 120);
  });
  
  // On viewport resize (mobile keyboard open/close), if input is focused keep view at bottom
  window.addEventListener('resize', ()=>{
    if(document.activeElement === messageInput){
      // short delay helps on some Android browsers
      setTimeout(()=> scrollToBottom(), 200);
    }
  });

  clearBtn && clearBtn.addEventListener('click', ()=> {
    clearConversation();
  });
  SEARCH_INPUT && SEARCH_INPUT.addEventListener('input', (e)=> renderConversations(e.target.value));

  // Init
  load();
  if(!conversations.length){
    createConversation('New chat');
  } else {
    renderConversations();
    renderMessages();
    updateHeader();
  }






socket.on("userMessage", (message) => {
  const wasAtBottom = isAtBottom();

  // 1️⃣ Turant typing dots show karo
  showTyping(true);
  if (wasAtBottom) scrollToBottom();

  // 2️⃣ Message length ke hisaab se realistic typing delay
  const typingDuration = Math.min(Math.max(message.length * 20, 50), 500); 

  setTimeout(() => {
    // 3️⃣ Typing indicator remove
    showTyping(false);

    // 4️⃣ Add AI message from backend
    addMessage('assistant', message, wasAtBottom);
  }, typingDuration);
});


})();
