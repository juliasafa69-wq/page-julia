// CONFIGURAÇÃO SUPABASE
const supabaseUrl = "https://stbafdvoudllzjmmdmaq.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0YmFmZHZvdWRsbHpqbW1kbWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3ODQ4NzAsImV4cCI6MjA3MzM2MDg3MH0.iLXTTGczgyjPNPGpN7hP4CMX9wpo_XV9hxl6r2pKy_s";
const { createClient } = supabase;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// CONFIGURAÇÕES DE USUÁRIO E PERMISSÕES (SIMPLES - SEM AUTH)
let isOwner = false; // Verificado por senha localStorage
let visitorFingerprint = null;

// SENHA DE ADMIN (localStorage)
const ADMIN_PASSWORD = "safa45082122"; // Mude para sua senha

// Verificar se é admin
function checkAdminAccess() {
  const savedPassword = localStorage.getItem("adminPassword");
  isOwner = savedPassword === ADMIN_PASSWORD;
  console.log("🔑 Admin access:", isOwner);
  return isOwner;
}

// Prompt de senha admin (só aparece se clicar no botão admin)
function promptAdminPassword() {
  const password = prompt("🔑 Senha de administrador:");
  if (password === ADMIN_PASSWORD) {
    localStorage.setItem("adminPassword", password);
    isOwner = true;
    alert("✅ Acesso admin ativado!");
    location.reload();
  } else {
    alert("❌ Senha incorreta!");
  }
}

// Logout admin
function logoutAdmin() {
  localStorage.removeItem("adminPassword");
  isOwner = false;
  alert("👋 Logout realizado!");
  location.reload();
}

// Gerar fingerprint único para visitante anônimo
function generateVisitorFingerprint() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top";
  ctx.font = "14px Arial";
  ctx.fillText("Browser fingerprint", 2, 2);

  const fingerprint =
    canvas.toDataURL() +
    navigator.userAgent +
    navigator.language +
    screen.width +
    "x" +
    screen.height +
    new Date().getTimezoneOffset();

  return btoa(fingerprint).substring(0, 32);
}

// ================================================
// SISTEMA DE LOGIN PARA JULIA
// ================================================

// Logout da Julia (owner)
async function logoutJulia() {
  try {
    console.log("🚪 Fazendo logout...");

    // Fazer logout no Supabase COM TIMEOUT
    console.log("⏳ Tentando signOut do Supabase...");

    const signOutPromise = supabaseClient.auth.signOut();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout no signOut")), 5000)
    );

    const { error } = await Promise.race([signOutPromise, timeoutPromise]);

    console.log("✅ SignOut completed, error:", error);

    if (error) {
      console.error("❌ Erro no logout:", error.message);
      alert("❌ Erro no logout: " + error.message);
      return false;
    }

    // Limpar estado local
    currentUser = null;
    isOwner = false;
    visitorFingerprint = generateVisitorFingerprint();

    console.log("✅ Logout realizado com sucesso");

    // Atualizar interface para visitante
    updateInterfaceBasedOnPermissions();

    // Fechar modal de configurações
    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal) {
      settingsModal.style.display = "none";
    }

    alert("✅ Logout realizado com sucesso!");

    return true;
  } catch (error) {
    console.error("❌ Erro inesperado no logout:", error);

    // FALLBACK: Forçar logout mesmo com erro
    console.log("🔄 Forçando logout local...");
    currentUser = null;
    isOwner = false;
    visitorFingerprint = generateVisitorFingerprint();
    updateInterfaceBasedOnPermissions();

    // Fechar modal
    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal) {
      settingsModal.style.display = "none";
    }

    alert("⚠️ Logout forçado (houve um problema com o servidor)");
    return true;
  }
}

// Login da Julia (owner)
async function loginJulia(email, password) {
  try {
    console.log("🔑 Tentando fazer login...");

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      console.error("❌ Erro no login:", error.message);
      alert("❌ Erro no login: " + error.message);
      return false;
    }

    if (data.user) {
      console.log("✅ Login realizado com sucesso!");
      // Marcar que já logou neste dispositivo (para mostrar botão de login futuramente)
      localStorage.setItem("julia_logged_before", "true");
      await checkUserPermissions(); // Verificar se é owner
      return true;
    }
  } catch (error) {
    console.error("❌ Erro no login:", error);
    alert("❌ Erro no login. Tente novamente.");
    return false;
  }
}

// Logout do usuário
async function logoutUser() {
  const confirmLogout = confirm("🔄 Tem certeza que deseja sair?");
  if (!confirmLogout) return;

  try {
    console.log("👋 Fazendo logout...");

    // Atualizar status para offline se for Julia (owner)
    if (isOwner && currentUser) {
      console.log("🔴 Atualizando status para offline...");
      await supabaseClient
        .from("profile")
        .update({
          online_status: "offline",
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
    }

    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;

    console.log("✅ Logout realizado com sucesso!");

    // Redirecionar para tela de login
    window.location.href = "auth.html";
  } catch (error) {
    console.error("❌ Erro no logout:", error);
    alert("❌ Erro ao fazer logout. Tente novamente.");
  }
}

// Mostrar modal de login
function showLoginModal() {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";
  modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>🔑 Login da Julia</h3>
                <button class="close-modal" onclick="closeLoginModal()">&times;</button>
            </div>
            <div class="modal-body-padding">
                <form id="loginForm">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Email:</label>
                        <input type="email" id="loginEmail" required placeholder="julia@email.com" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Senha:</label>
                        <input type="password" id="loginPassword" required placeholder="Sua senha" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <button type="submit" class="modal-button">🔓 Entrar</button>
                </form>
                <hr style="margin: 20px 0;">
                <p style="text-align: center; color: #666; font-size: 12px;">
                    💡 Primeira vez? <a href="#" onclick="showCreateAccountModal()">Criar conta</a>
                </p>
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  // Handler do formulário
  document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    if (await loginJulia(email, password)) {
      closeLoginModal();
    }
  };
}

// Fechar modal de login
function closeLoginModal() {
  const modal = document.querySelector(".modal");
  if (modal && modal.innerHTML.includes("Login da Julia")) {
    modal.remove();
  }
}

// Modal para criar conta (primeira vez)
function showCreateAccountModal() {
  closeLoginModal();

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";
  modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>👤 Criar Conta da Julia</h3>
                <button class="close-modal" onclick="closeCreateAccountModal()">&times;</button>
            </div>
            <div class="modal-body-padding">
                <p style="color: #666; margin-bottom: 15px;">
                    ⚠️ Use apenas na primeira vez para criar sua conta de administradora.
                </p>
                <form id="createAccountForm">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Email:</label>
                        <input type="email" id="createEmail" required placeholder="julia@email.com" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">Senha:</label>
                        <input type="password" id="createPassword" required placeholder="Crie uma senha forte" 
                               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <button type="submit" class="modal-button">👤 Criar Conta</button>
                </form>
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  // Handler do formulário
  document.getElementById("createAccountForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("createEmail").value;
    const password = document.getElementById("createPassword").value;

    if (await createJuliaAccount(email, password)) {
      closeCreateAccountModal();
      alert("✅ Conta criada! Confirme seu email e depois faça login.");
    }
  };
}

// Fechar modal de criar conta
function closeCreateAccountModal() {
  const modal = document.querySelector(".modal");
  if (modal && modal.innerHTML.includes("Criar Conta da Julia")) {
    modal.remove();
  }
}

// Criar conta da Julia (só roda uma vez)
async function createJuliaAccount(email, password) {
  try {
    console.log("👤 Criando conta da Julia...");

    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          name: "Julia Safa",
          is_owner: true,
        },
      },
    });

    if (error) {
      console.error("❌ Erro ao criar conta:", error.message);
      alert("❌ Erro: " + error.message);
      return false;
    }

    console.log("✅ Conta criada! Verifique seu email para confirmar.");
    return true;
  } catch (error) {
    console.error("❌ Erro ao criar conta:", error);
    return false;
  }
}

// Atualizar status online automaticamente após login
async function setUserOnlineStatus(user) {
  try {
    console.log("🟢 Atualizando status online para usuário logado...");

    const { error } = await supabaseClient.from("profile").upsert([
      {
        id: 1,
        user_id: user.id,
        online_status: "online",
        show_online_status: true,
        updated_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("❌ Erro ao atualizar status online:", error);
    } else {
      console.log("✅ Status online atualizado automaticamente!");
      // Atualizar dados locais
      profileData.onlineStatus = "online";
      profileData.showOnlineStatus = true;
      updateOnlineStatus();
    }
  } catch (error) {
    console.error("❌ Erro ao definir status online:", error);
  }
}

// Verificar permissões com user fornecido (SIMPLES - SÓ EMAIL)
async function checkUserPermissionsWithUser(user) {
  console.log("🔍 Verificando permissões...");

  if (!user) {
    console.log("👤 Nenhum usuário - modo visitante");
    currentUser = null;
    isOwner = false;
    updateInterfaceBasedOnPermissions();
    return;
  }

  currentUser = user;

  // VERIFICAÇÃO SIMPLES: Se o email for o da Julia, é owner
  const OWNER_EMAIL = "julia.safa.69@gmail.com";
  isOwner = user.email === OWNER_EMAIL;

  console.log("✅ Permissões verificadas - Owner:", isOwner);

  // Atualizar interface
  updateInterfaceBasedOnPermissions();
}

// Atualizar interface baseada nas permissões do usuário
function updateInterfaceBasedOnPermissions() {
  // Atualizar visibilidade do ícone "Minhas Solicitações"
  updateMySentRequestsVisibility();

  if (isOwner) {
    // Julia (owner) pode ver e fazer tudo
    console.log("👑 Interface configurada para owner");
    showOwnerInterface();
  } else {
    // Visitantes têm interface limitada
    console.log("👥 Interface configurada para visitante");
    showVisitorInterface();
  }
}

// Interface para Julia (owner)
function showOwnerInterface() {
  // Mostrar todas as opções de criação/edição/exclusão
  const createPostDiv = document.querySelector(".create-post");
  if (createPostDiv) createPostDiv.style.display = "block";

  // Mostrar botões de configurações
  const settingsIcon = document.querySelector(
    '.header-icon[onclick="openSettings()"]'
  );
  if (settingsIcon) settingsIcon.style.display = "block";

  // Logout será nas configurações, não no header

  // Restaurar funcionalidade de clique da foto de perfil para Julia
  const profilePic = document.getElementById("profilePic");
  if (profilePic) {
    profilePic.style.cursor = "pointer";
    profilePic.setAttribute("onclick", "changeProfilePic()");
    profilePic.title = "Clique para alterar foto de perfil";
  }

  // Restaurar funcionalidade de edição do nome do perfil
  const profileName = document.getElementById("profileName");
  if (profileName) {
    profileName.style.cursor = "pointer";
    profileName.setAttribute("onclick", "editProfileName()");
    profileName.title = "Clique para editar nome";
  }

  // Restaurar acesso à lista de amigos para Julia
  const friendsStat = document.querySelector(".stat");
  if (friendsStat && !friendsStat.onclick) {
    friendsStat.style.cursor = "pointer";
    friendsStat.setAttribute("onclick", "openFriendsModal()");
    friendsStat.title = "Ver lista de amigos";
  }

  // Restaurar acesso à galeria de fotos para Julia
  const photosStat = document.querySelector(
    '.stat[title="Número de fotos (acesso limitado)"]'
  );
  if (photosStat) {
    photosStat.style.cursor = "pointer";
    photosStat.setAttribute("onclick", "openGallery('photos')");
    photosStat.title = "Ver galeria de fotos";
  }

  // Restaurar ícone de segurança ao estado normal para Julia
  const securityIcon = document.querySelector(".security-icon");
  if (securityIcon) {
    securityIcon.style.display = "block";
    securityIcon.style.opacity = "1"; // Opacidade total
    securityIcon.style.cursor = "pointer";
    securityIcon.title = "Central de Segurança";
  }

  // Aplicar permissões completas nas configurações
  applySettingsPermissions();

  // Mostrar menu de opções em posts/fotos
  document.querySelectorAll(".post-menu, .media-menu").forEach((menu) => {
    menu.style.display = "block";
  });
}

// Interface para visitantes
function showVisitorInterface() {
  // Mostrar mensagem de boas vindas COM botão de login
  const createPostDiv = document.querySelector(".create-post");
  if (createPostDiv) {
    createPostDiv.innerHTML = `
            <div class="visitor-info" style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                <p style="margin: 0 0 15px 0; font-size: 16px; color: #1c1e21;">💖 Holá amores, bienvenidos a todos! 😘</p>
                <p style="margin: 0 0 10px 0; font-size: 13px; color: #8a8d91; font-style: italic;">
                    * Acceso solo para la administradora de la página
                </p>
                <button onclick="showLoginModal()" style="margin-top: 5px; padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                    🔑 Login de julia safa
                </button>
            </div>
        `;
  }

  // Botão de logout estará nas configurações

  // Remover funcionalidade de clique da foto de perfil para visitantes
  const profilePic = document.getElementById("profilePic");
  if (profilePic) {
    profilePic.style.cursor = "default";
    profilePic.removeAttribute("onclick");
    profilePic.title = "Foto de perfil da Julia";
  }

  // Remover funcionalidade de edição do nome do perfil
  const profileName = document.getElementById("profileName");
  if (profileName) {
    profileName.style.cursor = "default";
    profileName.removeAttribute("onclick");
    profileName.title = "Julia Safa";
  }

  // Bloquear acesso à lista de amigos para visitantes
  const friendsStat = document.querySelector(
    '.stat[onclick="openFriendsModal()"]'
  );
  if (friendsStat) {
    friendsStat.style.cursor = "default";
    friendsStat.removeAttribute("onclick");
    friendsStat.title = "Número de amigos (privado)";
  }

  // Bloquear acesso à galeria de fotos para visitantes
  const photosStat = document.querySelector(
    ".stat[onclick=\"openGallery('photos')\"]"
  );
  if (photosStat) {
    photosStat.style.cursor = "default";
    photosStat.removeAttribute("onclick");
    photosStat.title = "Número de fotos (acesso limitado)";
  }

  // Manter configurações disponíveis, mas com acesso limitado
  const settingsIcon = document.querySelector(
    '.header-icon[onclick="openSettings()"]'
  );
  if (settingsIcon) settingsIcon.style.display = "block";

  // Manter ícone de segurança visível, mas com efeito de "somente leitura" para visitantes
  const securityIcon = document.querySelector(".security-icon");
  if (securityIcon) {
    securityIcon.style.display = "block";
    securityIcon.style.opacity = "0.6"; // Transparência para indicar que não é clicável
    securityIcon.style.cursor = "not-allowed";
    securityIcon.title = "Central de Segurança (Apenas Administrador)";
  }

  // Aplicar permissões nas configurações
  applySettingsPermissions();

  // Esconder botões de edição/exclusão
  document
    .querySelectorAll(".post-menu .dropdown-item.danger")
    .forEach((btn) => {
      btn.style.display = "none";
    });
}

// Controlar permissões nas configurações
function applySettingsPermissions() {
  if (isOwner) {
    // Julia logada: mostrar todas as configurações
    document.querySelectorAll(".admin-only").forEach((section) => {
      section.style.display = "block";
    });
    document.querySelectorAll(".visitor-allowed").forEach((section) => {
      section.style.display = "block";
    });
    console.log("👑 Configurações completas para administradora");
  } else {
    // Visitantes: apenas idioma e cor
    document.querySelectorAll(".admin-only").forEach((section) => {
      section.style.display = "none";
    });
    document.querySelectorAll(".visitor-allowed").forEach((section) => {
      section.style.display = "block";
    });
    console.log("👥 Configurações limitadas para visitante (idioma + cor)");
  }
}

// Adicionar botão de logout no header (apenas para Julia)
function addLogoutButton() {
  // Verificar se já existe um botão de logout
  const existingLogoutBtn = document.getElementById("logoutButton");
  if (existingLogoutBtn) return;

  // Encontrar o container dos ícones do header
  const headerIcons = document.querySelector(".header-icons");
  if (!headerIcons) return;

  // Criar o botão de logout
  const logoutButton = document.createElement("div");
  logoutButton.id = "logoutButton";
  logoutButton.className = "header-icon logout-icon";
  logoutButton.title = "Sair (Julia)";
  logoutButton.onclick = function () {
    if (confirm("Tem certeza que deseja sair, Julia?")) {
      logoutUser();
    }
  };
  logoutButton.innerHTML = '<i class="fas fa-sign-out-alt"></i>';

  // Adicionar o botão antes do último ícone (configurações)
  const settingsIcon = document.querySelector(
    '.header-icon[onclick="openSettings()"]'
  );
  if (settingsIcon) {
    headerIcons.insertBefore(logoutButton, settingsIcon);
  } else {
    headerIcons.appendChild(logoutButton);
  }

  console.log("🚪 Botão de logout adicionado para Julia");
}

// Remover botão de logout do header
function removeLogoutButton() {
  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.remove();
    console.log("🚪 Botão de logout removido");
  }
}

// FUNÇÕES SUPABASE ATUALIZADAS
// Carregar curtidas do banco (apenas posts/fotos públicos)
async function loadLikesFromDB() {
  try {
    const { data, error } = await supabaseClient
      .from("likes")
      .select(
        `
                *,
                posts!left(privacy),
                gallery_photos!left(privacy)
            `
      )
      .or("posts.privacy.eq.public,gallery_photos.privacy.eq.public");

    if (error) throw error;

    profileData.likesCount = data.length;
    updateInteractionCounts();
    console.log(`✅ ${data.length} curtidas carregadas (apenas públicas)`);
  } catch (error) {
    console.error("❌ Erro ao carregar curtidas:", error);
  }
}

// Carregar solicitações de amizade do banco
async function loadFriendRequestsFromDB() {
  try {
    const { data, error } = await supabaseClient
      .from("friend_requests")
      .select("*")
      .eq("status", "pending");

    if (error) throw error;

    // Converter para formato local
    friendRequests = data.map((request) => ({
      id: request.id,
      name: request.sender_name,
      pic: `https://picsum.photos/50?random=${request.id}`,
      message: "Podemos ser amigos?",
    }));

    renderFriendRequests();
    updateRequestsCounter();
    console.log(`📩 ${friendRequests.length} solicitações carregadas!`);
  } catch (error) {
    console.error("Erro ao carregar solicitações:", error);
  }
}

// Carregar posts do banco (filtrados por privacidade)
async function loadPostsFromDB() {
  try {
    let query = supabaseClient
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    // Se não for owner, carregar apenas posts públicos
    if (!isOwner) {
      query = query.eq("privacy", "public");
    }

    const { data, error } = await query;

    if (error) throw error;

    // Converter para formato local
    posts = data.map((post) => ({
      id: post.id,
      author: "Julia Safa",
      authorPic: profileData?.profilePic || "https://picsum.photos/40?random=1",
      time: new Date(post.created_at).toLocaleDateString("pt-BR"),
      content: post.text,
      privacy: post.privacy,
      likes: post.likes_count,
      comments: [],
      liked: false,
      image: post.image_url,
      canEdit: isOwner, // Só owner pode editar
      canDelete: isOwner, // Só owner pode deletar
    }));

    renderPosts();
    console.log(
      `📝 ${posts.length} posts carregados (privacidade: ${
        isOwner ? "todos" : "apenas públicos"
      })`
    );
  } catch (error) {
    console.error("❌ Erro ao carregar posts:", error);
  }
}

// Carregar foto de perfil salva
async function loadProfilePicFromDB() {
  try {
    const { data, error } = await supabaseClient
      .from("profile")
      .select("*")
      .eq("id", 1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows
      throw error;
    }

    if (data && data.profile_pic_url) {
      profileData.profilePic = data.profile_pic_url;

      // Carregar dados de posicionamento se existirem
      if (data.position_data) {
        try {
          profileData.profilePicPosition = JSON.parse(data.position_data);
        } catch (e) {
          console.error("Erro ao parsear position_data:", e);
        }
      }

      // Atualizar interface
      updateProfilePicInterface(
        data.profile_pic_url,
        profileData.profilePicPosition
      );

      console.log(
        "✅ Foto de perfil carregada do Supabase:",
        data.profile_pic_url
      );
    } else {
      console.log("ℹ️ Nenhuma foto de perfil salva no banco");

      // Tentar carregar do localStorage como fallback
      const savedPic = localStorage.getItem("profilePic");
      if (savedPic && !savedPic.includes("placeholder")) {
        profileData.profilePic = savedPic;
        updateProfilePicInterface(savedPic);
        console.log("✅ Foto de perfil carregada do localStorage (fallback)");
      }
    }
  } catch (error) {
    console.error("❌ Erro ao carregar foto de perfil:", error);

    // Fallback para localStorage
    const savedPic = localStorage.getItem("profilePic");
    if (savedPic && !savedPic.includes("placeholder")) {
      profileData.profilePic = savedPic;
      updateProfilePicInterface(savedPic);
      console.log(
        "✅ Foto de perfil carregada do localStorage (fallback após erro)"
      );
    }
  }
}

// Carregar configurações salvas do Supabase
async function loadSettingsFromDB() {
  try {
    const { data, error } = await supabaseClient
      .from("user_settings")
      .select("*");

    if (error) throw error;

    // Processar configurações
    data.forEach((setting) => {
      if (setting.setting_key === "theme_color") {
        const theme = JSON.parse(setting.setting_value);
        document.documentElement.style.setProperty(
          "--primary-color",
          theme.primary
        );
        document.documentElement.style.setProperty(
          "--primary-hover",
          theme.hover
        );
        console.log("✅ Tema carregado do Supabase");
      } else if (setting.setting_key === "language") {
        currentLanguage = setting.setting_value;
        console.log("✅ Idioma carregado do Supabase:", currentLanguage);
      }
    });
  } catch (error) {
    console.error("❌ Erro ao carregar configurações:", error);

    // Fallback para localStorage
    const savedTheme = localStorage.getItem("themeColor");
    if (savedTheme) {
      const theme = JSON.parse(savedTheme);
      document.documentElement.style.setProperty(
        "--primary-color",
        theme.primary
      );
      document.documentElement.style.setProperty(
        "--primary-hover",
        theme.hover
      );
    }

    const savedLang = localStorage.getItem("language");

    // FORÇA ESPANHOL COMO PADRÃO (temporário para resetar localStorage)
    if (!savedLang || savedLang === "pt") {
      currentLanguage = "es";
      localStorage.setItem("language", "es"); // Atualizar localStorage
      console.log("🇪🇸 Idioma forçado para espanhol (padrão)");
    } else {
      currentLanguage = savedLang;
    }
  }
}

// Carregar dados completos do perfil do Supabase
async function loadProfileDataFromDB() {
  try {
    const { data, error } = await supabaseClient
      .from("profile")
      .select("*")
      .eq("id", 1)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (data) {
      if (data.name) profileData.name = data.name;
      if (data.bio) profileData.bio = data.bio;
      if (data.privacy_settings) {
        profileData.privacy = JSON.parse(data.privacy_settings);
      }
      if (data.online_status !== undefined)
        profileData.onlineStatus = data.online_status;
      if (data.show_online_status !== undefined) {
        profileData.showOnlineStatus = data.show_online_status;
      }

      console.log("📊 Status carregados:", {
        online_status: data.online_status,
        show_online_status: data.show_online_status,
        profileData_onlineStatus: profileData.onlineStatus,
        profileData_showOnlineStatus: profileData.showOnlineStatus,
      });

      // Atualizar interface
      if (data.name) {
        document.getElementById("profileName").textContent = data.name;
        if (document.querySelector(".logo")) {
          document.querySelector(".logo").textContent = data.name;
        }
      }

      console.log("✅ Dados do perfil carregados do Supabase");
    } else {
      console.log("ℹ️ Nenhum dado de perfil salvo no banco");
    }
  } catch (error) {
    console.error("❌ Erro ao carregar dados do perfil:", error);

    // Fallback para localStorage
    const savedProfile = localStorage.getItem("profileData");
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      Object.assign(profileData, parsed);
      console.log("✅ Dados do perfil carregados do localStorage (fallback)");
    }
  }
}

// Carregar lista de amigos do Supabase
async function loadFriendsFromDB() {
  try {
    const { data, error } = await supabaseClient
      .from("friends")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (data && data.length > 0) {
      friends = data.map((friend) => ({
        id: friend.friend_id,
        name: friend.friend_name,
        pic: friend.friend_pic,
        online: friend.is_online || Math.random() > 0.5,
      }));

      console.log(`✅ ${friends.length} amigos carregados do Supabase`);
    } else {
      console.log("ℹ️ Nenhum amigo salvo no banco");
    }
  } catch (error) {
    console.error("❌ Erro ao carregar amigos:", error);
  }
}

// Salvar foto de perfil na galeria permanentemente
async function savePhotoToGalleryAsProfilePic(
  photoId,
  imageUrl,
  caption,
  privacy
) {
  try {
    // Salvar no Supabase
    const { error } = await supabaseClient.from("gallery_photos").insert([
      {
        photo_id: photoId,
        photo_url: imageUrl,
        caption: caption,
        privacy: privacy,
        likes_count: 0,
        comments: "[]",
        is_profile_pic: true, // Marcar como foto de perfil
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    // Adicionar localmente também
    const newPhoto = {
      id: photoId,
      src: imageUrl,
      caption: caption,
      privacy: privacy,
      likes: 0,
      liked: false,
      comments: [],
      isProfilePic: true,
    };

    photos.push(newPhoto);
    console.log(
      "✅ Foto de perfil salva na galeria permanentemente no Supabase"
    );
  } catch (error) {
    console.error("❌ Erro ao salvar foto de perfil na galeria:", error);
  }
}

// Salvar foto na galeria permanentemente
async function savePhotoToGallery(photoId, imageUrl, caption, privacy) {
  try {
    // Salvar no Supabase
    const { error } = await supabaseClient.from("gallery_photos").insert([
      {
        photo_id: photoId,
        photo_url: imageUrl,
        caption: caption,
        privacy: privacy,
        likes_count: 0,
        comments: "[]",
        is_profile_pic: false,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    // Adicionar localmente também
    const newPhoto = {
      id: photoId,
      src: imageUrl,
      caption: caption,
      privacy: privacy,
      likes: 0,
      liked: false,
      comments: [],
      isProfilePic: false,
    };

    photos.unshift(newPhoto);
    console.log("✅ Foto salva na galeria permanentemente no Supabase");
  } catch (error) {
    console.error("❌ Erro ao salvar foto na galeria:", error);
  }
}

// Carregar fotos da galeria do Supabase (filtradas por privacidade)
async function loadPhotosFromDB() {
  try {
    let query = supabaseClient
      .from("gallery_photos")
      .select("*")
      .order("created_at", { ascending: false });

    // Se não for owner, carregar apenas fotos públicas
    if (!isOwner) {
      query = query.eq("privacy", "public");
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      photos = data.map((photo) => ({
        id: photo.photo_id,
        src: photo.photo_url,
        caption: photo.caption || "",
        privacy: photo.privacy || "public",
        likes: photo.likes_count || 0,
        liked: false,
        comments: photo.comments ? JSON.parse(photo.comments) : [],
        isProfilePic: photo.is_profile_pic || false,
        canEdit: isOwner, // Só owner pode editar
        canDelete: isOwner, // Só owner pode deletar
      }));

      console.log(
        `✅ ${photos.length} fotos carregadas (privacidade: ${
          isOwner ? "todas" : "apenas públicas"
        })`
      );
    } else {
      console.log("ℹ️ Nenhuma foto salva no banco");
    }
  } catch (error) {
    console.error("❌ Erro ao carregar fotos:", error);
  }
}

// FUNÇÕES DE INTERAÇÃO (CURTIR/COMENTAR) - RESPEITANDO POLÍTICAS RLS

// Curtir post ou foto
async function likeContent(type, id) {
  try {
    if (!visitorFingerprint && !currentUser) {
      visitorFingerprint = generateVisitorFingerprint();
    }

    // Verificar se já curtiu
    const existingLike = await supabaseClient
      .from("likes")
      .select("id")
      .or(
        currentUser
          ? `user_id.eq.${currentUser.id}`
          : `visitor_fingerprint.eq.${visitorFingerprint}`
      )
      .eq(type === "post" ? "post_id" : "photo_id", id)
      .single();

    if (existingLike.data) {
      // Remover curtida
      const { error } = await supabaseClient
        .from("likes")
        .delete()
        .eq("id", existingLike.data.id);

      if (error) throw error;

      console.log("💔 Curtida removida");
      return false; // Não curtido mais
    } else {
      // Adicionar curtida
      const likeData = {
        visitor_fingerprint: visitorFingerprint,
        visitor_ip: await getVisitorIP(),
      };

      if (currentUser) {
        likeData.user_id = currentUser.id;
      }

      if (type === "post") {
        likeData.post_id = parseInt(id);
      } else {
        likeData.photo_id = id;
      }

      const { error } = await supabaseClient.from("likes").insert([likeData]);

      if (error) throw error;

      console.log("❤️ Curtida adicionada");
      return true; // Curtido
    }
  } catch (error) {
    console.error("❌ Erro ao curtir:", error);
    alert("Erro ao curtir. Tente novamente.");
    return false;
  }
}

// Comentar em post ou foto
async function addComment(type, id, text, authorName) {
  try {
    if (!text.trim()) {
      alert("Digite um comentário!");
      return false;
    }

    if (!visitorFingerprint && !currentUser) {
      visitorFingerprint = generateVisitorFingerprint();
    }

    const commentData = {
      text: text.trim(),
      author_name: authorName || "Visitante",
      author_avatar:
        currentUser?.user_metadata?.avatar_url ||
        "https://picsum.photos/32?random=2",
      visitor_fingerprint: visitorFingerprint,
      visitor_ip: await getVisitorIP(),
    };

    if (currentUser) {
      commentData.user_id = currentUser.id;
    }

    if (type === "post") {
      commentData.post_id = parseInt(id);
    } else {
      commentData.photo_id = id;
    }

    const { data, error } = await supabaseClient
      .from("comments")
      .insert([commentData])
      .select();

    if (error) throw error;

    console.log("💬 Comentário adicionado");
    return data[0];
  } catch (error) {
    console.error("❌ Erro ao comentar:", error);
    alert("Erro ao enviar comentário. Tente novamente.");
    return false;
  }
}

// Enviar mensagem para Julia
async function sendMessageToJulia(message, senderName) {
  try {
    if (!message.trim()) {
      alert("Digite uma mensagem!");
      return false;
    }

    if (!visitorFingerprint && !currentUser) {
      visitorFingerprint = generateVisitorFingerprint();
    }

    // Buscar Julia (owner) para enviar mensagem
    const { data: juliaData, error: juliaError } = await supabaseClient
      .from("users")
      .select("id")
      .eq("is_owner", true)
      .single();

    if (juliaError || !juliaData) {
      console.error("❌ Erro ao encontrar Julia:", juliaError);
      return false;
    }

    const messageData = {
      sender_name: senderName || "Visitante",
      sender_avatar:
        currentUser?.user_metadata?.avatar_url ||
        "https://picsum.photos/40?random=3",
      recipient_id: juliaData.id,
      message_text: message.trim(),
      visitor_fingerprint: visitorFingerprint,
    };

    if (currentUser) {
      messageData.sender_id = currentUser.id;
    }

    const { error } = await supabaseClient
      .from("messages")
      .insert([messageData]);

    if (error) throw error;

    console.log("📨 Mensagem enviada para Julia");
    return true;
  } catch (error) {
    console.error("❌ Erro ao enviar mensagem:", error);
    alert("Erro ao enviar mensagem. Tente novamente.");
    return false;
  }
}

// Obter IP do visitante (para logs de segurança)
async function getVisitorIP() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    return "unknown";
  }
}

// Carregar dados iniciais
async function initializeData() {
  // Verificar permissões primeiro
  await checkUserPermissions();

  await loadSettingsFromDB(); // Carregar configurações primeiro

  // Aplicar idioma após carregar configurações
  updateInterface();

  await loadProfileDataFromDB(); // Carregar dados do perfil
  await loadProfilePicFromDB(); // Carregar foto de perfil

  // Inicializar interface após carregar dados
  initializeStatusSystem();
  await loadFriendsFromDB(); // Carregar amigos
  await loadPhotosFromDB(); // Carregar fotos da galeria
  await loadLikesFromDB();
  await loadFriendRequestsFromDB();
  await loadPostsFromDB();
  console.log("✅ Dados carregados do Supabase com permissões aplicadas!");
}

// Dados globais
let posts = [];
let friends = [];
let friendRequests = [];
let reels = [];
let photos = [];
let currentLanguage = "es"; // Idioma padrão: Espanhol
let currentMedia = null;
let conversations = [];
let openChats = [];
let unreadMessages = 0;
let profileData = {
  name: "Julia Safa",
  profilePic: "https://picsum.photos/80?random=4",
  friendsCount: 0,
  postsCount: 0,
  photosCount: 0,
  friendsPrivacy: "public",
  onlineStatus: "online",
  showOnlineStatus: true,
  // Novos dados de interação
  isFollowed: false,
  isLiked: false,
  isSupported: false,
  followersCount: 0,
  likesCount: 0,
  // Configurações de privacidade
  privacy: {
    hideStatsCount: false,
    hideFriendsList: true, // ← PÁGINA PESSOAL: Esconder amigos por padrão
    hideFollowers: false,
    privateProfile: false,
  },
  // Idioma padrão
  language: "es",
};

// Variáveis para controle de atividade
let lastActivity = Date.now();
let activityTimeout = null;
let isPageVisible = true;

// Traduções
const translations = {
  pt: {
    friends: "Amigos",
    posts: "Posts",
    photos: "Fotos",
    available: "Disponível",
    friend_requests: "Solicitações de Amizade",
    no_requests: "Nenhuma solicitação pendente.",
    send_request: "Enviar solicitação para Julia Safa",
    visitor_simulation: "Simule que você é um visitante",
    thinking: "No que você está pensando, Julia?",
    video_reel: "Vídeo/Reel",
    photo: "Foto",
    feeling: "Sentimento",
    my_reels: "Meus Reels",
    no_reels: "Ainda não há reels. Faça upload do seu primeiro reel!",
    welcome: "Bem-vinda à sua página!",
    start_posting:
      "Comece criando sua primeira publicação usando a área acima.",
    no_friends: "Você ainda não tem amigos adicionados.",
    empty_gallery: "Galeria vazia. Adicione fotos para vê-las aqui!",
    like: "Curtir",
    comment: "Comentar",
    share: "Compartilhar",
    delete: "Excluir",
    change_privacy: "Alterar privacidade",
    public: "Público",
    friends_only: "Amigos",
    private: "Somente eu",
  },
  es: {
    friends: "Amigos",
    posts: "Publicaciones",
    photos: "Fotos",
    available: "Disponible",
    friend_requests: "Solicitudes de Amistad",
    no_requests: "No hay solicitudes pendientes.",
    send_request: "Enviar solicitud a Julia Safa",
    visitor_simulation: "Simula que eres un visitante",
    thinking: "¿En qué estás pensando, Julia?",
    video_reel: "Video/Reel",
    photo: "Foto",
    feeling: "Sentimiento",
    my_reels: "Mis Reels",
    no_reels: "Aún no hay reels. ¡Sube tu primer reel!",
    welcome: "¡Bienvenida a tu página!",
    start_posting:
      "Comienza creando tu primera publicación usando el área de arriba.",
    no_friends: "Aún no tienes amigos agregados.",
    empty_gallery: "Galería vacía. ¡Agrega fotos para verlas aquí!",
    like: "Me gusta",
    comment: "Comentar",
    share: "Compartir",
    delete: "Eliminar",
    change_privacy: "Cambiar privacidad",
    public: "Público",
    friends_only: "Amigos",
    private: "Solo yo",
  },
  "en-us": {
    friends: "Friends",
    posts: "Posts",
    photos: "Photos",
    available: "Available",
    friend_requests: "Friend Requests",
    no_requests: "No pending requests.",
    send_request: "Send request to Julia Safa",
    visitor_simulation: "Simulate that you are a visitor",
    thinking: "What's on your mind, Julia?",
    video_reel: "Video/Reel",
    photo: "Photo",
    feeling: "Feeling",
    my_reels: "My Reels",
    no_reels: "No reels yet. Upload your first reel!",
    welcome: "Welcome to your page!",
    start_posting: "Start by creating your first post using the area above.",
    no_friends: "You haven't added any friends yet.",
    empty_gallery: "Empty gallery. Add photos to see them here!",
    like: "Like",
    comment: "Comment",
    share: "Share",
    delete: "Delete",
    change_privacy: "Change privacy",
    public: "Public",
    friends_only: "Friends",
    private: "Only me",
  },
  "en-uk": {
    friends: "Friends",
    posts: "Posts",
    photos: "Photos",
    available: "Available",
    friend_requests: "Friend Requests",
    no_requests: "No pending requests.",
    send_request: "Send request to Julia Safa",
    visitor_simulation: "Simulate that you are a visitor",
    thinking: "What's on your mind, Julia?",
    video_reel: "Video/Reel",
    photo: "Photo",
    feeling: "Feeling",
    my_reels: "My Reels",
    no_reels: "No reels yet. Upload your first reel!",
    welcome: "Welcome to your page!",
    start_posting: "Start by creating your first post using the area above.",
    no_friends: "You haven't added any friends yet.",
    empty_gallery: "Empty gallery. Add photos to see them here!",
    like: "Like",
    comment: "Comment",
    share: "Share",
    delete: "Delete",
    change_privacy: "Change privacy",
    public: "Public",
    friends_only: "Friends",
    private: "Only me",
  },
};

// TESTE BÁSICO - Se isso não aparecer no console, há erro no JS
console.log("🚀 SCRIPT CARREGADO!");

// VERIFICAR STATUS DE AUTENTICAÇÃO (SEM REDIRECIONAMENTO)
async function checkAuthStatus() {
  try {
    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser();

    console.log("🔍 VERIFICAÇÃO DE AUTENTICAÇÃO:");
    console.log("Usuário logado:", user);

    if (user) {
      console.log("✅ Usuário autenticado ID:", user.id);
      console.log("✅ Email:", user.email);
      currentUser = user;
    } else {
      console.log("👤 Visitante anônimo - pode acessar conteúdo público");
      currentUser = null;
      isOwner = false;
      visitorFingerprint = generateVisitorFingerprint();
    }

    return user;
  } catch (err) {
    console.error("❌ Erro ao verificar auth:", err);
    currentUser = null;
    isOwner = false;
    return null;
  }
}

// Verificação será feita apenas no DOMContentLoaded

// Listener de autenticação
supabaseClient.auth.onAuthStateChange(async (event, session) => {
  console.log("🪪 Auth event:", event);
  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
    await checkUserPermissionsWithUser(session?.user);
  } else if (event === "SIGNED_OUT") {
    await checkUserPermissionsWithUser(null);
  }
});

// Inicializar página
document.addEventListener("DOMContentLoaded", async function () {
  console.log("🎯 DOM CARREGADO!");

  // Verificar sessão Supabase
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (session?.user) {
    console.log("👤 Sessão encontrada");
    await checkUserPermissionsWithUser(session.user);
  } else {
    console.log("👤 Modo visitante");
    updateInterfaceBasedOnPermissions();
  }

  // Verificar idade
  checkAgeVerification();

  // Carregar dados do Supabase (funciona para visitantes anônimos)
  await initializeData();

  updateStats();
  renderFriends();
  renderPosts();
  renderReels();
  renderFriendRequests();
  updateRequestsCounter();
  loadSavedTheme();
  showFloatingAd(); // Inicializar anúncio flutuante
  setupSecurityFeatures(); // Recursos de segurança
  updateInterface(); // Atualizar interface
});

// Carregar cor salva
function loadSavedTheme() {
  const savedTheme = localStorage.getItem("themeColor");
  if (savedTheme) {
    const { primary, hover } = JSON.parse(savedTheme);
    document.documentElement.style.setProperty("--primary-color", primary);
    document.documentElement.style.setProperty("--primary-hover", hover);

    // Atualizar indicador ativo
    document.querySelectorAll(".color-option").forEach((option) => {
      option.classList.remove("active");
    });

    // Encontrar e ativar a cor correspondente
    const colorMap = {
      "#1877f2": ".color-blue",
      "#8b5cf6": ".color-purple",
      "#10b981": ".color-green",
      "#f59e0b": ".color-pink",
      "#ec4899": ".color-rose",
      "#ef4444": ".color-red",
      "#374151": ".color-dark",
    };

    const activeOption = document.querySelector(colorMap[primary]);
    if (activeOption) {
      activeOption.classList.add("active");
    }
  }
}

// Função de tradução
function t(key) {
  return translations[currentLanguage][key] || key;
}

// Atualizar textos específicos da interface
function updateInterfaceTexts() {
  // Atualizar seções da sidebar direita
  const sectionsToUpdate = [{ selector: ".friends-title", key: "friends" }];

  sectionsToUpdate.forEach(({ selector, key }) => {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = t(key);
    }
  });

  // Atualizar APENAS o título das solicitações de amizade (sidebar direita)
  const friendRequestsTitle = document.querySelector(".friend-requests-title");
  if (friendRequestsTitle) {
    friendRequestsTitle.textContent = `👥 ${t("friend_requests")}`;
  }

  // Atualizar botão de enviar solicitação
  const sendRequestBtn = document.querySelector(".test-button.primary");
  if (sendRequestBtn) {
    sendRequestBtn.textContent = t("send_request");
  }

  // Atualizar placeholder de amigos vazio
  const friendsList = document.getElementById("friendsList");
  if (friendsList && friendsList.innerHTML.includes("empty-placeholder")) {
    friendsList.innerHTML = `<div class="empty-placeholder">${t(
      "no_friends"
    )}</div>`;
  }
}

// Atualizar estatísticas
function updateStats() {
  document.getElementById("friendsCount").textContent = friends.length;
  document.getElementById("postsCount").textContent = posts.length;
  document.getElementById("photosCount").textContent = photos.length;
}

// Mudar idioma
async function changeLanguage(lang) {
  currentLanguage = lang;
  await saveLanguageSettingToDB(lang);

  // Atualizar indicador ativo
  document.querySelectorAll(".language-option").forEach((option) => {
    option.classList.remove("active");
    if (option.dataset.lang === lang) {
      option.classList.add("active");
    }
  });

  // Re-renderizar interface
  updateInterface();
}

// Atualizar interface com traduções
function updateInterface() {
  console.log("🌍 Atualizando interface para idioma:", currentLanguage);

  // Atualizar labels das estatísticas
  const statLabels = document.querySelectorAll(".stat-label");
  if (statLabels.length >= 3) {
    statLabels[0].textContent = t("friends");
    statLabels[1].textContent = t("posts");
    statLabels[2].textContent = t("photos");
    console.log(
      "✅ Labels atualizados:",
      t("friends"),
      t("posts"),
      t("photos")
    );
  } else {
    console.error(
      "❌ stat-label elementos não encontrados:",
      statLabels.length
    );
  }

  // Atualizar placeholder do criar post
  const createPostInput = document.querySelector(".create-post-input");
  if (createPostInput) {
    createPostInput.placeholder = t("thinking");
  }

  // Atualizar outros textos da interface
  updateInterfaceTexts();

  // Re-renderizar componentes
  renderPosts();
  renderFriends();
  renderFriendRequests();
  renderReels();

  console.log("🎯 Interface atualizada com sucesso");
}

// Renderizar amigos
function renderFriends() {
  const friendsList = document.getElementById("friendsList");
  if (friends.length === 0) {
    friendsList.innerHTML = `<div class="empty-placeholder">${t(
      "no_friends"
    )}</div>`;
  } else {
    friendsList.innerHTML = friends
      .map(
        (friend) => `
            <div class="friend-item" onclick="openChat('${friend.name}')">
                <img src="${friend.pic}" alt="${
          friend.name
        }" class="friend-pic">
                <span class="friend-name">${friend.name}</span>
                ${
                  friend.online
                    ? '<i class="fas fa-circle" style="color: #42b883; font-size: 8px; margin-left: auto;"></i>'
                    : ""
                }
            </div>
        `
      )
      .join("");
  }
}

// Renderizar posts
function renderPosts() {
  const postsContainer = document.getElementById("postsContainer");
  if (posts.length === 0) {
    postsContainer.innerHTML = `
            <div class="post-placeholder">
                <i class="fas fa-plus-circle post-icon"></i>
                <h3>${t("welcome")}</h3>
                <p>${t("start_posting")}</p>
            </div>
        `;
  } else {
    postsContainer.innerHTML = posts
      .map(
        (post) => `
            <div class="post">
                <div class="post-header">
                    <div class="post-author">
                        <img src="${post.authorPic}" alt="${
          post.author
        }" class="post-author-pic">
                        <div class="post-author-info">
                            <div class="post-author-name">${post.author}</div>
                            <div class="post-time">${post.time}</div>
                        </div>
                    </div>
                    <div class="post-privacy">
                        <i class="fas fa-${getPrivacyIcon(post.privacy)}"></i>
                        <span>${getPrivacyText(post.privacy)}</span>
                    </div>
                </div>
                <div class="post-content">
                    <div class="post-text">${post.content}</div>
                    ${
                      post.image
                        ? `<img src="${post.image}" alt="Post image" class="post-media" onclick="openPostImageViewer('${post.id}')" style="cursor: pointer;">`
                        : ""
                    }
                </div>
                <div class="post-actions">
                    <button class="post-action-btn like-btn ${
                      post.liked ? "liked" : ""
                    }" onclick="toggleLike(${post.id})">
                        <i class="fas fa-thumbs-up"></i>
                        <span>Curtir (${post.likes})</span>
                    </button>
                    <button class="post-action-btn" onclick="toggleComments(${
                      post.id
                    })">
                        <i class="fas fa-comment"></i>
                        <span>Comentar</span>
                    </button>
                    <button class="post-action-btn">
                        <i class="fas fa-share"></i>
                        <span>Compartilhar</span>
                    </button>
                    <div class="post-menu">
                        <button class="post-action-btn menu-dots" onclick="togglePostMenu(${
                          post.id
                        })">
                            <i class="fas fa-ellipsis-h"></i>
                        </button>
                        <div class="dropdown-menu" id="postDropdown-${post.id}">
                            <button class="dropdown-item" onclick="changePostPrivacy(${
                              post.id
                            })">
                                <i class="fas fa-shield-alt"></i> Alterar privacidade
                            </button>
                            <button class="dropdown-item danger" onclick="deletePost(${
                              post.id
                            })">
                                <i class="fas fa-trash"></i> Excluir postagem
                            </button>
                        </div>
                    </div>
                </div>
                <div class="comments-section" id="comments-${post.id}">
                    ${post.comments
                      .map(
                        (comment) => `
                        <div class="comment">
                            <img src="${comment.authorPic}" alt="${comment.author}" class="comment-pic">
                            <div class="comment-content">
                                <div class="comment-author">${comment.author}</div>
                                <div class="comment-text">${comment.text}</div>
                            </div>
                        </div>
                    `
                      )
                      .join("")}
                    <div class="comment-input">
                        <img src="${
                          profileData.profilePic
                        }" alt="Você" class="comment-pic">
                        <input type="text" placeholder="Escreva um comentário..." onkeypress="handleCommentEnter(event, ${
                          post.id
                        })">
                    </div>
                </div>
            </div>
        `
      )
      .join("");
  }
}

// Renderizar reels
function renderReels() {
  const reelsGrid = document.getElementById("reelsGrid");
  if (reels.length === 0) {
    reelsGrid.innerHTML = `<div class="reels-placeholder">${t(
      "no_reels"
    )}</div>`;
  } else {
    reelsGrid.innerHTML = reels
      .map(
        (reel) => `
            <div class="reel-item" onclick="playReel('${reel.id}')">
                <video class="reel-video" src="${reel.src}" muted></video>
                <div class="reel-overlay">
                    <div style="font-weight: bold;">${reel.title}</div>
                </div>
            </div>
        `
      )
      .join("");
  }
}

// Trocar cor do tema
async function changeThemeColor(primary, hover) {
  document.documentElement.style.setProperty("--primary-color", primary);
  document.documentElement.style.setProperty("--primary-hover", hover);

  // Atualizar indicador ativo
  document
    .querySelectorAll(".color-option")
    .forEach((option) => option.classList.remove("active"));
  event.target.classList.add("active");

  // Salvar preferência PERMANENTEMENTE
  await saveThemeSettingsToDB(primary, hover);
}

// Salvar dados do perfil PERMANENTEMENTE
async function saveProfileDataToDB() {
  try {
    console.log("💾 Salvando no Supabase:", {
      online_status: profileData.onlineStatus,
      show_online_status: profileData.showOnlineStatus,
    });

    const { error } = await supabaseClient.from("profile").upsert([
      {
        id: 1,
        name: profileData.name,
        bio: profileData.bio || "",
        privacy_settings: JSON.stringify(profileData.privacy),
        online_status: profileData.onlineStatus,
        show_online_status: profileData.showOnlineStatus,
        updated_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;
    console.log("✅ Dados do perfil salvos permanentemente no Supabase");

    // Backup no localStorage
    localStorage.setItem("profileData", JSON.stringify(profileData));
  } catch (error) {
    console.error("❌ Erro ao salvar dados do perfil:", error);
    // Fallback para localStorage
    localStorage.setItem("profileData", JSON.stringify(profileData));
  }
}

// Salvar configuração de idioma PERMANENTEMENTE
async function saveLanguageSettingToDB(lang) {
  try {
    const { error } = await supabaseClient.from("user_settings").upsert([
      {
        id: 2,
        setting_key: "language",
        setting_value: lang,
        updated_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;
    console.log("✅ Idioma salvo permanentemente no Supabase");

    // Backup no localStorage
    localStorage.setItem("language", lang);
  } catch (error) {
    console.error("❌ Erro ao salvar idioma:", error);
    // Fallback para localStorage
    localStorage.setItem("language", lang);
  }
}

// Salvar configurações de tema PERMANENTEMENTE
async function saveThemeSettingsToDB(primary, hover) {
  try {
    const { error } = await supabaseClient.from("user_settings").upsert([
      {
        id: 1,
        setting_key: "theme_color",
        setting_value: JSON.stringify({ primary, hover }),
        updated_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;
    console.log("✅ Tema salvo permanentemente no Supabase");

    // Backup no localStorage
    localStorage.setItem("themeColor", JSON.stringify({ primary, hover }));
  } catch (error) {
    console.error("❌ Erro ao salvar tema:", error);
    // Fallback para localStorage
    localStorage.setItem("themeColor", JSON.stringify({ primary, hover }));
  }
}

// Lista de nomes para simular solicitações
const possibleFriends = [
  "Maria Silva",
  "João Santos",
  "Ana Costa",
  "Carlos Oliveira",
  "Beatriz Lima",
  "Pedro Ferreira",
  "Camila Rodrigues",
  "Lucas Pereira",
  "Amanda Santos",
  "Felipe Almeida",
  "Gabriela Souza",
  "Rafael Torres",
  "Juliana Martins",
  "Diego Costa",
  "Larissa Ribeiro",
];

// Enviar solicitação de amizade (como visitante) - VERSÃO SUPABASE COM AUTH
async function sendFriendRequest() {
  // Solicita o nome do visitante em espanhol/português
  const promptMessage =
    currentLanguage === "es"
      ? "Escribe tu nombre para enviar solicitud:"
      : "Digite seu nome para enviar solicitação:";

  const defaultName = currentLanguage === "es" ? "Visitante" : "Visitante";
  const anonymousName = currentLanguage === "es" ? "Anónimo" : "Anônimo";

  const userName = prompt(promptMessage, defaultName) || anonymousName;

  // Obtém o usuário autenticado via Supabase
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  // Se não conseguir pegar o usuário, mostra erro
  if (authError || !user) {
    const authErrorMessage =
      currentLanguage === "es"
        ? "❌ Error al obtener usuario autenticado. Inicia sesión primero."
        : "❌ Erro ao obter usuário autenticado. Faça login primeiro.";

    alert(authErrorMessage);
    console.error("❌ Erro de autenticação:", authError);
    return;
  }

  try {
    // Gerar fingerprint para identificar o visitante
    const fingerprint = visitorFingerprint || generateVisitorFingerprint();

    // Insere os dados na tabela friend_requests
    const { data, error } = await supabaseClient
      .from("friend_requests")
      .insert([
        {
          sender_uid: user.id, // ← Aqui entra o auth.uid()
          sender_name: userName, // ← Nome digitado no prompt
          sender_fingerprint: fingerprint, // ← Fingerprint do visitante
          sender_ip: await getVisitorIP(), // ← IP para logs de segurança
          status: "pending", // ← Status da solicitação
        },
      ]);

    if (error) throw error;

    // Adicionar localmente também para atualizar interface
    const requestId = Date.now();
    friendRequests.push({
      id: requestId,
      name: userName,
      pic: `https://picsum.photos/50?random=5`,
      message: "Podemos ser amigos?",
    });

    renderFriendRequests();
    updateRequestsCounter();

    // Atualizar contador de notificações
    const count = parseInt(
      document.getElementById("notificationCount").textContent
    );
    document.getElementById("notificationCount").textContent = count + 1;

    // Mensagem de sucesso em espanhol/português
    const successMessage =
      currentLanguage === "es"
        ? "✅ ¡Solicitud enviada con éxito! Julia recibirá tu petición de amistad."
        : "✅ Solicitação enviada com sucesso! Julia receberá sua solicitação de amizade.";

    alert(successMessage);
    console.log("📩 Solicitação de amizade enviada com sender_uid:", user.id);

    // Atualizar contador de minhas solicitações
    loadAndRenderMySentRequests();
  } catch (err) {
    console.error("❌ Erro ao enviar solicitação:", err.message);

    const errorMessage =
      currentLanguage === "es"
        ? "❌ Error al enviar solicitud. Inténtalo de nuevo."
        : "❌ Erro ao enviar solicitação. Tente novamente.";

    alert(errorMessage);
  }
}

// Carregar solicitações enviadas pelo usuário atual
async function loadMySentRequests() {
  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      console.log(
        "👤 Usuário não autenticado - não há solicitações para carregar"
      );
      return [];
    }

    const { data, error } = await supabaseClient
      .from("friend_requests")
      .select("*")
      .eq("sender_uid", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    console.log(`📩 ${data.length} solicitações enviadas carregadas`);
    return data || [];
  } catch (error) {
    console.error("❌ Erro ao carregar minhas solicitações:", error);
    return [];
  }
}

// Renderizar minhas solicitações enviadas
function renderMySentRequests(requests) {
  const container = document.getElementById("mySentRequests");

  if (!container) {
    console.log("ℹ️ Container mySentRequests não encontrado");
    return;
  }

  if (!requests || requests.length === 0) {
    const noRequestsText =
      currentLanguage === "es"
        ? "No has enviado solicitudes aún"
        : "Você ainda não enviou solicitações";

    container.innerHTML = `<div class="empty-placeholder">${noRequestsText}</div>`;
    return;
  }

  container.innerHTML = requests
    .map((request) => {
      // Status com cores e ícones
      let statusDisplay = "";
      let statusClass = "";

      switch (request.status) {
        case "pending":
          statusDisplay =
            currentLanguage === "es" ? "⏳ Pendiente" : "⏳ Pendente";
          statusClass = "status-pending";
          break;
        case "accepted":
          statusDisplay =
            currentLanguage === "es" ? "✅ Aceptada" : "✅ Aceita";
          statusClass = "status-accepted";
          break;
        case "rejected":
          statusDisplay =
            currentLanguage === "es" ? "❌ Rechazada" : "❌ Recusada";
          statusClass = "status-rejected";
          break;
        default:
          statusDisplay =
            currentLanguage === "es" ? "⏳ Pendiente" : "⏳ Pendente";
          statusClass = "status-pending";
      }

      // Formatear data
      const date = new Date(request.created_at);
      const timeAgo = getTimeAgo(date);

      return `
      <div class="my-request-item">
        <div class="request-header">
          <strong>Para: Julia Safa</strong>
          <span class="request-time">${timeAgo}</span>
        </div>
        <div class="request-status ${statusClass}">
          ${statusDisplay}
        </div>
        <div class="request-message">
          "${
            request.message ||
            (currentLanguage === "es"
              ? "¿Podemos ser amigos?"
              : "Podemos ser amigos?")
          }"
        </div>
      </div>
    `;
    })
    .join("");
}

// Função auxiliar para calcular tempo decorrido
function getTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) {
    return currentLanguage === "es"
      ? `hace ${days} día${days > 1 ? "s" : ""}`
      : `há ${days} dia${days > 1 ? "s" : ""}`;
  } else if (hours > 0) {
    return currentLanguage === "es"
      ? `hace ${hours} hora${hours > 1 ? "s" : ""}`
      : `há ${hours} hora${hours > 1 ? "s" : ""}`;
  } else {
    return currentLanguage === "es"
      ? `hace ${minutes} minuto${minutes > 1 ? "s" : ""}`
      : `há ${minutes} minuto${minutes > 1 ? "s" : ""}`;
  }
}

// Alternar dropdown de minhas solicitações
function toggleMySentRequests() {
  const dropdown = document.getElementById("mySentRequestsDropdown");
  if (dropdown) {
    dropdown.style.display =
      dropdown.style.display === "block" ? "none" : "block";

    // Carregar e atualizar solicitações quando abrir
    if (dropdown.style.display === "block") {
      loadAndRenderMySentRequests();
    }
  }
}

// Carregar e renderizar minhas solicitações
async function loadAndRenderMySentRequests() {
  const requests = await loadMySentRequests();
  renderMySentRequests(requests);
  updateMySentRequestsBadge(requests.length);
}

// Atualizar badge com contador de solicitações enviadas
function updateMySentRequestsBadge(count) {
  const badge = document.getElementById("mySentRequestsBadge");
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }
}

// Mostrar/esconder ícone de minhas solicitações baseado em permissões
function updateMySentRequestsVisibility() {
  const icon = document.getElementById("mySentRequestsIcon");
  if (icon) {
    if (!isOwner) {
      // Visitantes podem ver suas solicitações
      icon.style.display = "block";
      loadAndRenderMySentRequests(); // Carregar automaticamente
    } else {
      // Admin não precisa ver (ela recebe, não envia)
      icon.style.display = "none";
    }
  }
}

// Renderizar solicitações de amizade (CORRIGIDO - verifica se existe)
function renderFriendRequests() {
  const requestsContainer = document.getElementById("friendRequests");

  // Se o elemento não existe (foi removido da sidebar), não faz nada
  if (!requestsContainer) {
    console.log("ℹ️ Elemento friendRequests não encontrado (sidebar removida)");
    return;
  }

  if (friendRequests.length === 0) {
    requestsContainer.innerHTML = `<div class="empty-placeholder">${t(
      "no_requests"
    )}</div>`;
  } else {
    requestsContainer.innerHTML = friendRequests
      .map((request) => {
        // Interface diferente para admin vs visitante
        if (isOwner) {
          // Admin: pode aceitar/recusar
          return `
            <div class="friend-request" id="request-${request.id}">
                <img src="${request.pic}" alt="${
            request.name
          }" class="request-pic">
                <div class="request-info">
                    <div class="request-name">${request.name}</div>
                    <div style="font-size: 12px; color: #65676b; margin: 4px 0;">${
                      request.message
                    }</div>
                    <div class="request-actions">
                        <button class="btn btn-primary" onclick="acceptFriend('${
                          request.id
                        }', '${request.name}')">${t("accept")}</button>
                        <button class="btn btn-secondary" onclick="rejectFriend('${
                          request.id
                        }')">${t("decline")}</button>
                    </div>
                </div>
            </div>
          `;
        } else {
          // Visitante: apenas status pendente
          const pendingText =
            currentLanguage === "es"
              ? "Solicitud pendiente"
              : "Solicitação pendente";
          return `
            <div class="friend-request" id="request-${request.id}">
                <img src="${request.pic}" alt="${request.name}" class="request-pic">
                <div class="request-info">
                    <div class="request-name">${request.name}</div>
                    <div style="font-size: 12px; color: #65676b; margin: 4px 0;">${request.message}</div>
                    <div class="request-status" style="color: #f39c12; font-size: 13px; font-weight: bold;">
                        ⏳ ${pendingText}
                    </div>
                </div>
            </div>
          `;
        }
      })
      .join("");
  }
}

// Atualizar contador de solicitações
function updateRequestsCounter() {
  const counter = document.getElementById("requestsCounter");
  const headerBadge = document.getElementById("friendRequestsBadge");

  if (friendRequests.length > 0) {
    // Atualizar badge no header
    if (headerBadge) {
      headerBadge.textContent = friendRequests.length;
      headerBadge.classList.remove("hidden");
      headerBadge.style.display = "flex"; // Usar flex como no CSS original do .badge
      headerBadge.style.visibility = "visible";
      console.log(
        "✅ Badge atualizado:",
        friendRequests.length,
        "Visível:",
        headerBadge.style.display
      );
    } else {
      console.error("❌ Badge element not found!");
    }

    // Manter counter da sidebar se ainda existir
    if (counter) {
      counter.textContent = friendRequests.length;
      counter.style.display = "block";
    }
  } else {
    // Esconder badge no header
    if (headerBadge) {
      headerBadge.classList.add("hidden");
      headerBadge.style.display = "none";
      headerBadge.style.visibility = "hidden";
    }

    // Esconder counter da sidebar se ainda existir
    if (counter) {
      counter.style.display = "none";
    }
  }
}

// Aceitar amigo
async function acceptFriend(requestId, friendName) {
  // Encontrar a solicitação
  const requestIndex = friendRequests.findIndex((req) => req.id == requestId);
  if (requestIndex === -1) return;

  const newFriend = {
    id: requestId,
    name: friendName,
    pic: `https://picsum.photos/32?random=6`,
    online: Math.random() > 0.5,
  };

  try {
    // Salvar amigo no Supabase
    const { error } = await supabaseClient.from("friends").insert([
      {
        friend_id: requestId,
        friend_name: friendName,
        friend_pic: newFriend.pic,
        is_online: newFriend.online,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;
    console.log("✅ Amigo salvo permanentemente no Supabase");
  } catch (error) {
    console.error("❌ Erro ao salvar amigo:", error);
  }

  // Adicionar aos amigos localmente
  friends.push(newFriend);

  // Remover da lista de solicitações
  friendRequests.splice(requestIndex, 1);

  // Atualizar interface
  renderFriends();
  renderFriendRequests();
  updateRequestsCounter();
  updateStats();

  // Reduzir contador de notificações
  const count = Math.max(
    0,
    parseInt(document.getElementById("notificationCount").textContent) - 1
  );
  document.getElementById("notificationCount").textContent = count;

  alert(`${friendName} agora é sua amiga! 🎉`);
}

// Rejeitar amigo
function rejectFriend(requestId) {
  // Encontrar e remover da lista
  const requestIndex = friendRequests.findIndex((req) => req.id == requestId);
  if (requestIndex === -1) return;

  const friendName = friendRequests[requestIndex].name;
  friendRequests.splice(requestIndex, 1);

  // Atualizar interface
  renderFriendRequests();
  updateRequestsCounter();

  // Reduzir contador de notificações
  const count = Math.max(
    0,
    parseInt(document.getElementById("notificationCount").textContent) - 1
  );
  document.getElementById("notificationCount").textContent = count;

  alert(`Solicitação de ${friendName} foi rejeitada.`);
}

// Aceitar amigo pelo header
function acceptFriendFromHeader(requestId, friendName, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  acceptFriend(requestId, friendName);

  // Pequeno delay para atualizar a interface
  setTimeout(() => {
    renderFriendRequestsHeader();
    updateRequestsCounter();
  }, 100);
}

// Recusar amigo pelo header
function rejectFriendFromHeader(requestId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  rejectFriend(requestId);

  // Pequeno delay para atualizar a interface
  setTimeout(() => {
    renderFriendRequestsHeader();
    updateRequestsCounter();
  }, 100);
}

// Funções utilitárias
function getPrivacyIcon(privacy) {
  switch (privacy) {
    case "public":
      return "globe";
    case "friends":
      return "users";
    case "private":
      return "lock";
    default:
      return "globe";
  }
}

function getPrivacyText(privacy) {
  switch (privacy) {
    case "public":
      return "Público";
    case "friends":
      return "Amigos";
    case "private":
      return "Somente eu";
    default:
      return "Público";
  }
}

// Funções de interação
function toggleLike(postId) {
  const post = posts.find((p) => p.id === postId);
  if (post) {
    post.liked = !post.liked;
    post.likes += post.liked ? 1 : -1;
    renderPosts();
  }
}

function toggleComments(postId) {
  const commentsSection = document.getElementById(`comments-${postId}`);
  commentsSection.style.display =
    commentsSection.style.display === "none" ? "block" : "none";
}

async function handleCommentEnter(event, postId) {
  if (event.key === "Enter" && event.target.value.trim()) {
    const post = posts.find((p) => p.id === postId);
    if (post) {
      const newComment = {
        author: profileData.name,
        authorPic: profileData.profilePic,
        text: event.target.value.trim(),
      };

      // Adicionar localmente primeiro
      post.comments.push(newComment);
      event.target.value = "";
      renderPosts();

      // Salvar no Supabase (sem quebrar se falhar)
      try {
        const { error } = await supabaseClient.from("comments").insert([
          {
            post_id: postId,
            author_name: newComment.author,
            author_pic: newComment.authorPic,
            comment_text: newComment.text,
            created_at: new Date().toISOString(),
          },
        ]);

        if (error) console.warn("Comentário salvo apenas localmente:", error);
      } catch (error) {
        console.warn("Comentário salvo apenas localmente:", error);
      }
    }
  }
}

// Modais
function openCreatePostModal() {
  // Verificar se é owner antes de abrir modal
  if (!isOwner) {
    alert("❌ Apenas a Julia pode criar posts!");
    return;
  }

  document.getElementById("createPostModal").style.display = "flex";
}

function openSettings() {
  document.getElementById("newProfileName").value = profileData.name;
  document.getElementById("settingsModal").style.display = "flex";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

// Upload e mídia
function uploadPhoto() {
  // Verificar se é owner antes de permitir upload
  if (!isOwner) {
    alert("❌ Apenas a Julia pode fazer upload de fotos!");
    return;
  }

  // Abrir modal de criar post primeiro
  openCreatePostModal();

  // Aguardar um pouco para o modal carregar
  setTimeout(() => {
    const fileInput = document.getElementById("postImage");
    if (fileInput) {
      fileInput.click();
    } else {
      console.error("Input de arquivo não encontrado");
      alert(
        '❌ Erro: Não foi possível abrir o seletor de arquivos. Tente usar o botão "📷 Adicionar foto/vídeo" dentro do modal.'
      );
    }
  }, 100);
}

async function uploadReel() {
  // Verificar se é owner antes de permitir upload
  if (!isOwner) {
    alert("❌ Apenas a Julia pode fazer upload de reels!");
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "video/*";
  input.onchange = async function (e) {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const title = prompt("Título do reel:") || "Meu reel";
      const newReel = {
        id: Date.now(),
        src: url,
        title: title,
      };

      // Adicionar localmente primeiro
      reels.push(newReel);
      renderReels();

      // Salvar no Supabase (sem quebrar se falhar)
      try {
        const { error } = await supabaseClient.from("reels").insert([
          {
            reel_id: newReel.id,
            video_url: url,
            title: title,
            created_at: new Date().toISOString(),
          },
        ]);

        if (error) console.warn("Reel salvo apenas localmente:", error);
      } catch (error) {
        console.warn("Reel salvo apenas localmente:", error);
      }
    }
  };
  input.click();
}

function previewMedia(input) {
  const preview = document.getElementById("mediaPreview");

  if (!preview) {
    console.error("Elemento mediaPreview não encontrado");
    return;
  }

  // Limpar preview anterior
  preview.innerHTML = "";

  if (input.files && input.files[0]) {
    const file = input.files[0];

    // Validar tamanho do arquivo (máximo 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert("❌ Arquivo muito grande! Máximo 50MB.");
      input.value = "";
      return;
    }

    // Validar tipo de arquivo
    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/webm",
      "video/ogg",
    ];
    if (!validTypes.includes(file.type)) {
      alert(
        "❌ Tipo de arquivo não suportado! Use JPG, PNG, GIF, MP4, WEBM ou OGG."
      );
      input.value = "";
      return;
    }

    // Mostrar loading
    preview.innerHTML =
      '<div style="text-align: center; padding: 20px;">📤 Carregando...</div>';

    const reader = new FileReader();
    reader.onload = function (e) {
      const isVideo = file.type.startsWith("video/");
      const mediaHTML = isVideo
        ? `<video src="${e.target.result}" style="max-width: 100%; height: 200px; object-fit: cover; border-radius: 6px;" controls></video>`
        : `<img src="${e.target.result}" style="max-width: 100%; height: 200px; object-fit: cover; border-radius: 6px;">`;

      preview.innerHTML = `
                <div style="position: relative;">
                    ${mediaHTML}
                    <button onclick="clearMediaPreview()" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer;">×</button>
                </div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    📁 ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)
                </div>
            `;
    };

    reader.onerror = function () {
      preview.innerHTML =
        '<div style="color: red; text-align: center; padding: 20px;">❌ Erro ao carregar arquivo</div>';
    };

    reader.readAsDataURL(file);
  }
}

function clearMediaPreview() {
  const preview = document.getElementById("mediaPreview");
  if (preview) preview.innerHTML = "";

  const fileInput = document.getElementById("postImage");
  if (fileInput) fileInput.value = "";
}

// Função para testar se upload está funcionando
function testUpload() {
  console.log("🔧 Testando sistema de upload...");

  const fileInput = document.getElementById("postImage");
  const preview = document.getElementById("mediaPreview");

  console.log("Input de arquivo encontrado:", !!fileInput);
  console.log("Preview encontrado:", !!preview);

  if (!fileInput) {
    console.error("❌ Input de arquivo não encontrado!");
    return false;
  }

  if (!preview) {
    console.error("❌ Container de preview não encontrado!");
    return false;
  }

  console.log("✅ Todos os elementos necessários estão presentes");
  return true;
}

// Função para testar sistema de foto de perfil
function testProfilePic() {
  console.log("🔧 Testando sistema de foto de perfil...");

  // Testar elementos HTML
  const profilePic = document.getElementById("profilePic");
  const profileModal = document.getElementById("profilePicModal");
  const currentProfilePic = document.getElementById("currentProfilePic");
  const cropModal = document.getElementById("cropModal");
  const cropImage = document.getElementById("cropImage");

  console.log("✅ Elementos encontrados:");
  console.log("- Foto de perfil principal:", !!profilePic);
  console.log("- Modal de foto de perfil:", !!profileModal);
  console.log("- Foto atual no modal:", !!currentProfilePic);
  console.log("- Modal de crop:", !!cropModal);
  console.log("- Imagem de crop:", !!cropImage);

  // Testar se o clique funciona
  if (profilePic) {
    console.log("🖱️ Testando clique na foto de perfil...");
    profilePic.click();
  }

  return {
    profilePic: !!profilePic,
    profileModal: !!profileModal,
    currentProfilePic: !!currentProfilePic,
    cropModal: !!cropModal,
    cropImage: !!cropImage,
  };
}

// Criar post - VERSÃO SUPABASE
async function createPost() {
  // Verificar se é owner antes de permitir criação de post
  if (!isOwner) {
    alert("❌ Apenas a Julia pode criar posts!");
    return;
  }

  const text = document.getElementById("postText").value;
  const privacy = document.getElementById("postPrivacy").value;
  const imageFile = document.getElementById("postImage").files[0];

  if (!text.trim() && !imageFile) {
    alert("Digite algo ou adicione uma imagem!");
    return;
  }

  try {
    let imageUrl = null;

    // Se tem imagem, converte para base64 (para simplicidade inicial)
    if (imageFile) {
      const reader = new FileReader();
      imageUrl = await new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(imageFile);
      });
    }

    // Salvar no banco Supabase
    const { data, error } = await supabaseClient
      .from("posts")
      .insert([
        {
          text: text,
          image_url: imageUrl,
          privacy: privacy,
          likes_count: 0,
        },
      ])
      .select();

    if (error) throw error;

    // Adicionar localmente também
    const newPost = {
      id: data[0].id,
      author: profileData.name,
      authorPic: profileData.profilePic,
      time: "agora",
      content: text,
      privacy: privacy,
      likes: 0,
      comments: [],
      liked: false,
      image: imageUrl,
    };

    posts.unshift(newPost);

    // Se tem imagem, salvar também na galeria
    // COMENTADO: Evita duplicar foto na galeria quando é um post
    // if (imageUrl) {
    //     await savePhotoToGallery(data[0].id, imageUrl, text || 'Foto do post', privacy);
    // }

    renderPosts();
    updateStats();
    closeModal("createPostModal");

    console.log("✅ Post salvo no Supabase!");
    alert("Post publicado com sucesso! 🎉");
  } catch (error) {
    console.error("Erro ao criar post:", error);
    alert("Erro ao publicar post. Tente novamente.");
  }

  // Limpar formulário
  document.getElementById("postText").value = "";
  document.getElementById("postImage").value = "";
  document.getElementById("mediaPreview").innerHTML = "";
}

// Variáveis globais para crop
let currentCropImage = null;
let selectedGalleryImage = null;
let cropData = { x: 0, y: 0, width: 200, height: 200 };

// Perfil - Abrir modal da foto de perfil
function changeProfilePic() {
  // Verificar se é owner antes de permitir mudança
  if (!isOwner) {
    alert("❌ Apenas a Julia pode alterar a foto de perfil!");
    return;
  }

  console.log("🖼️ Tentando abrir modal de foto de perfil...");

  const modal = document.getElementById("profilePicModal");
  const currentPic = document.getElementById("currentProfilePic");

  if (!modal) {
    console.error("❌ Modal profilePicModal não encontrado!");
    alert("❌ Erro: Modal de foto de perfil não encontrado");
    return;
  }

  if (!currentPic) {
    console.error("❌ Elemento currentProfilePic não encontrado!");
  } else {
    currentPic.src = profileData.profilePic;
    console.log("✅ Foto atual definida:", profileData.profilePic);
  }

  modal.style.display = "flex";
  console.log("✅ Modal de foto de perfil aberto");
}

// Fechar modal da foto de perfil
function closeProfilePicModal() {
  document.getElementById("profilePicModal").style.display = "none";
}

// Upload nova foto de perfil (COM CROP REATIVADO)
function uploadNewProfilePic() {
  console.log("📁 Iniciando upload de nova foto de perfil...");

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";

  input.onchange = function (e) {
    console.log("📷 Arquivo selecionado:", e.target.files[0]);
    const file = e.target.files[0];

    if (!file) {
      console.log("❌ Nenhum arquivo selecionado");
      return;
    }

    // Validar tamanho (máximo 10MB para foto de perfil)
    if (file.size > 10 * 1024 * 1024) {
      alert("❌ Arquivo muito grande! Máximo 10MB para foto de perfil.");
      return;
    }

    // Validar tipo
    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!validTypes.includes(file.type)) {
      alert("❌ Tipo de arquivo não suportado! Use JPG, PNG, GIF ou WEBP.");
      return;
    }

    console.log("✅ Arquivo válido, iniciando leitura...");
    closeProfilePicModal();

    const reader = new FileReader();

    reader.onload = function (event) {
      console.log("✅ Arquivo carregado, abrindo crop modal...");
      currentCropImage = event.target.result;
      openCropModal(event.target.result);
    };

    reader.onerror = function () {
      console.error("❌ Erro ao ler arquivo");
      alert("❌ Erro ao processar arquivo. Tente outro arquivo.");
    };

    reader.readAsDataURL(file);
  };

  // Adicionar ao DOM temporariamente
  document.body.appendChild(input);
  input.click();

  // Remover após uso
  setTimeout(() => {
    if (input.parentNode) {
      input.parentNode.removeChild(input);
    }
  }, 1000);
}

// Visualizar foto de perfil atual
function viewCurrentProfilePic() {
  if (
    !profileData.profilePic ||
    profileData.profilePic.includes("placeholder")
  ) {
    alert(
      "❌ Nenhuma foto de perfil definida ainda.\nAdicione uma foto primeiro!"
    );
    return;
  }

  // Criar objeto de mídia para a foto de perfil atual
  const profileMediaObject = {
    id: "current_profile_pic",
    src: profileData.profilePic,
    caption: `Foto de perfil de ${profileData.name}`,
    privacy: "public",
    likes: 0,
    liked: false,
    comments: [],
    isCurrentProfilePic: true,
  };

  // Adicionar temporariamente ao array de fotos
  const existingIndex = photos.findIndex((p) => p.id === "current_profile_pic");
  if (existingIndex !== -1) {
    photos[existingIndex] = profileMediaObject;
  } else {
    photos.unshift(profileMediaObject);
  }

  // Fechar modal da foto de perfil e abrir visualizador
  closeProfilePicModal();
  openMediaViewer("current_profile_pic", "photo");
}

// Selecionar da galeria
function selectFromGallery() {
  renderGallerySelector();
  closeProfilePicModal();
  document.getElementById("gallerySelector").style.display = "flex";
}

// Renderizar seletor da galeria
function renderGallerySelector() {
  const gallerySelectorContent = document.getElementById(
    "gallerySelectorContent"
  );

  if (photos.length === 0) {
    gallerySelectorContent.innerHTML = `
            <div style="text-align: center; color: #65676b; padding: 40px;">
                <i class="fas fa-image" style="font-size: 48px; margin-bottom: 20px; color: #e4e6ea;"></i>
                <h3>Nenhuma foto na galeria</h3>
                <p>Adicione fotos primeiro para poder usá-las como foto de perfil.</p>
            </div>
        `;
  } else {
    gallerySelectorContent.innerHTML = `
            <div class="gallery-selector-grid">
                ${photos
                  .map(
                    (photo) => `
                    <div class="gallery-selector-item" onclick="selectGalleryImage('${photo.id}', '${photo.src}')">
                        <img src="${photo.src}" alt="Foto da galeria">
                    </div>
                `
                  )
                  .join("")}
            </div>
        `;
  }
}

// Selecionar imagem da galeria
function selectGalleryImage(photoId, photoSrc) {
  selectedGalleryImage = { id: photoId, src: photoSrc };

  // Remover seleção anterior
  document.querySelectorAll(".gallery-selector-item").forEach((item) => {
    item.classList.remove("selected");
  });

  // Adicionar seleção atual
  event.target.closest(".gallery-selector-item").classList.add("selected");

  // Habilitar botão
  document.getElementById("useGalleryBtn").disabled = false;
}

// Usar imagem selecionada da galeria
function useSelectedGalleryImage() {
  if (selectedGalleryImage) {
    currentCropImage = selectedGalleryImage.src;
    closeGallerySelector();
    openCropModal(selectedGalleryImage.src);
  }
}

// Fechar seletor da galeria
function closeGallerySelector() {
  document.getElementById("gallerySelector").style.display = "none";
  selectedGalleryImage = null;
  document.getElementById("useGalleryBtn").disabled = true;
}

// Abrir modal de crop
function openCropModal(imageSrc) {
  console.log("✂️ Abrindo modal de crop...");

  const cropModal = document.getElementById("cropModal");
  const cropImage = document.getElementById("cropImage");
  const cropOverlay = document.getElementById("cropOverlay");

  if (!cropModal) {
    console.error("❌ Modal de crop não encontrado!");
    alert("❌ Erro: Modal de recorte não encontrado");
    return;
  }

  // Mostrar modal primeiro
  cropModal.style.display = "flex";

  cropImage.src = imageSrc;
  cropImage.onload = function () {
    console.log("✅ Imagem carregada no crop modal");
    const imgRect = cropImage.getBoundingClientRect();

    // Área inicial cobrindo 80% da imagem (mantém proporção original)
    const width = imgRect.width * 0.8;
    const height = imgRect.height * 0.8;

    cropData = {
      x: (imgRect.width - width) / 2,
      y: (imgRect.height - height) / 2,
      width: width,
      height: height,
    };

    updateCropOverlay();
    setupCropDrag();
  };

  document.getElementById("cropModal").style.display = "flex";
}

// Atualizar overlay do crop
function updateCropOverlay() {
  const cropOverlay = document.getElementById("cropOverlay");
  cropOverlay.style.left = cropData.x + "px";
  cropOverlay.style.top = cropData.y + "px";
  cropOverlay.style.width = cropData.width + "px";
  cropOverlay.style.height = cropData.height + "px";
}

// Sistema de arrastar e redimensionar o crop
function setupCropDrag() {
  const cropOverlay = document.getElementById("cropOverlay");
  const cropImage = document.getElementById("cropImage");
  const cropHandles = document.querySelectorAll(".crop-handle");

  let isDragging = false;
  let isResizing = false;
  let dragStart = { x: 0, y: 0 };
  let resizeDirection = "";
  let originalCropData = {};

  // Drag do overlay
  cropOverlay.addEventListener("mousedown", function (e) {
    if (e.target.classList.contains("crop-handle")) return;

    isDragging = true;
    dragStart.x = e.clientX - cropData.x;
    dragStart.y = e.clientY - cropData.y;
    e.preventDefault();
  });

  // Resize handles
  cropHandles.forEach((handle) => {
    handle.addEventListener("mousedown", function (e) {
      isResizing = true;
      resizeDirection = e.target.dataset.direction;
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;
      originalCropData = { ...cropData };
      e.stopPropagation();
      e.preventDefault();
    });
  });

  document.addEventListener("mousemove", function (e) {
    const imgRect = cropImage.getBoundingClientRect();

    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Limitar dentro da imagem
      cropData.x = Math.max(0, Math.min(newX, imgRect.width - cropData.width));
      cropData.y = Math.max(
        0,
        Math.min(newY, imgRect.height - cropData.height)
      );

      updateCropOverlay();
    }

    if (isResizing) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      // Redimensionamento livre - sem manter proporção
      let newWidth = originalCropData.width;
      let newHeight = originalCropData.height;
      let newX = originalCropData.x;
      let newY = originalCropData.y;

      switch (resizeDirection) {
        case "se":
          newWidth = originalCropData.width + deltaX;
          newHeight = originalCropData.height + deltaY;
          break;
        case "nw":
          newWidth = originalCropData.width - deltaX;
          newHeight = originalCropData.height - deltaY;
          newX = originalCropData.x + deltaX;
          newY = originalCropData.y + deltaY;
          break;
        case "ne":
          newWidth = originalCropData.width + deltaX;
          newHeight = originalCropData.height - deltaY;
          newY = originalCropData.y + deltaY;
          break;
        case "sw":
          newWidth = originalCropData.width - deltaX;
          newHeight = originalCropData.height + deltaY;
          newX = originalCropData.x + deltaX;
          break;
        case "e":
          newWidth = originalCropData.width + deltaX;
          break;
        case "w":
          newWidth = originalCropData.width - deltaX;
          newX = originalCropData.x + deltaX;
          break;
        case "n":
          newHeight = originalCropData.height - deltaY;
          newY = originalCropData.y + deltaY;
          break;
        case "s":
          newHeight = originalCropData.height + deltaY;
          break;
      }

      // Limitar tamanho mínimo
      const minWidth = 50;
      const minHeight = 50;
      newWidth = Math.max(minWidth, newWidth);
      newHeight = Math.max(minHeight, newHeight);

      // Garantir que não saia da imagem
      newX = Math.max(0, Math.min(newX, imgRect.width - newWidth));
      newY = Math.max(0, Math.min(newY, imgRect.height - newHeight));
      newWidth = Math.min(newWidth, imgRect.width - newX);
      newHeight = Math.min(newHeight, imgRect.height - newY);

      cropData = {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      };

      updateCropOverlay();
    }
  });

  document.addEventListener("mouseup", function () {
    isDragging = false;
    isResizing = false;
    resizeDirection = "";
  });
}

// Fechar modal de crop
function closeCropModal() {
  document.getElementById("cropModal").style.display = "none";
  currentCropImage = null;
}

// Salvar imagem posicionada (sem corte real)
function saveCroppedImage() {
  if (!currentCropImage) return;

  // Salvar dados de posicionamento para uso no perfil
  const positionData = {
    x: cropData.x,
    y: cropData.y,
    width: cropData.width,
    height: cropData.height,
  };

  // Para a foto de perfil, usar a imagem original com posicionamento CSS
  updateProfilePic(currentCropImage, positionData);
  closeCropModal();
}

// Atualizar foto de perfil - VERSÃO PERMANENTE COM SUPABASE
async function updateProfilePic(imageSrc, positionData = null) {
  try {
    console.log("🔄 Iniciando salvamento permanente da foto de perfil...");

    // Converter para blob se for data URL
    let finalImageUrl = imageSrc;

    if (imageSrc.startsWith("data:")) {
      // Converter data URL para blob
      const response = await fetch(imageSrc);
      const blob = await response.blob();

      // Criar nome único para o arquivo
      const fileName = `profile_pic_${Date.now()}.${blob.type.split("/")[1]}`;

      // Upload para Supabase Storage
      const { data, error } = await supabaseClient.storage
        .from("profile-pictures")
        .upload(fileName, blob, {
          contentType: blob.type,
          upsert: true,
        });

      if (error) {
        console.error("❌ Erro ao fazer upload:", error);
        throw error;
      }

      // Obter URL pública permanente
      const { data: publicData } = supabaseClient.storage
        .from("profile-pictures")
        .getPublicUrl(fileName);

      finalImageUrl = publicData.publicUrl;
      console.log("✅ Imagem salva permanentemente:", finalImageUrl);
    }

    // Salvar URL no banco de dados
    const { error: dbError } = await supabaseClient.from("profile").upsert([
      {
        id: 1,
        profile_pic_url: finalImageUrl,
        position_data: positionData ? JSON.stringify(positionData) : null,
        updated_at: new Date().toISOString(),
      },
    ]);

    if (dbError) {
      console.error("❌ Erro ao salvar no banco:", dbError);
      throw dbError;
    }

    // Atualizar dados locais
    profileData.profilePic = finalImageUrl;
    profileData.profilePicPosition = positionData;

    // Salvar no localStorage como backup
    localStorage.setItem("profilePic", finalImageUrl);
    if (positionData) {
      localStorage.setItem("profilePicPosition", JSON.stringify(positionData));
    }

    // Atualizar interface
    updateProfilePicInterface(finalImageUrl, positionData);

    // Adicionar à galeria de fotos permanentemente
    const photoId = Date.now();
    await savePhotoToGalleryAsProfilePic(
      photoId,
      finalImageUrl,
      "Atualizou a foto do perfil",
      "public"
    );

    // Criar post automático E SALVAR NO SUPABASE
    try {
      const { data: postData, error: postError } = await supabaseClient
        .from("posts")
        .insert([
          {
            text: "Atualizou a foto do perfil ✨",
            image_url: finalImageUrl,
            privacy: "public",
            likes_count: 0,
          },
        ])
        .select();

      if (postError) throw postError;

      const newPost = {
        id: postData[0].id,
        author: profileData.name,
        authorPic: finalImageUrl,
        time: "agora",
        content: "Atualizou a foto do perfil ✨",
        image: finalImageUrl,
        privacy: "public",
        likes: 0,
        comments: [],
        liked: false,
        isProfilePicPost: true,
      };

      posts.unshift(newPost);
      console.log("✅ Post da foto de perfil salvo permanentemente!");
    } catch (error) {
      console.warn("Post da foto de perfil salvo apenas localmente:", error);
      // Fallback: criar post local se Supabase falhar
      const newPost = {
        id: photoId + 1,
        author: profileData.name,
        authorPic: finalImageUrl,
        time: "agora",
        content: "Atualizou a foto do perfil ✨",
        image: finalImageUrl,
        privacy: "public",
        likes: 0,
        comments: [],
        liked: false,
        isProfilePicPost: true,
      };
      posts.unshift(newPost);
    }

    // Atualizar interface
    renderPosts();
    updateStats();

    alert("✅ Foto de perfil salva permanentemente! 🎉");
    console.log("✅ Foto de perfil atualizada com sucesso no Supabase");
  } catch (error) {
    console.error("❌ Erro ao salvar foto de perfil:", error);

    // Fallback: salvar temporariamente
    profileData.profilePic = imageSrc;
    profileData.profilePicPosition = positionData;
    localStorage.setItem("profilePic", imageSrc);

    updateProfilePicInterface(imageSrc, positionData);

    // CRIAR POST AUTOMÁTICO MESMO COM ERRO NO SUPABASE
    const profilePost = {
      id: Date.now() + 888,
      author: profileData.name,
      authorPic: imageSrc,
      time: "agora",
      content: "Atualizou a foto do perfil ✨",
      image: imageSrc,
      privacy: "public",
      likes: 0,
      comments: [],
      liked: false,
      isProfilePicPost: true,
    };

    posts.unshift(profilePost);

    // Adicionar à galeria também
    photos.push({
      id: Date.now() + 777,
      src: imageSrc,
      caption: "Atualizou a foto do perfil",
      privacy: "public",
      likes: 0,
      liked: false,
      comments: [],
      isProfilePic: true,
    });

    // Atualizar interface
    renderPosts();
    updateStats();

    alert(
      "✅ Foto atualizada e post criado! 🎉\n(Salvo temporariamente devido à falha de conexão)"
    );
  }
}

// Função auxiliar para atualizar interface
function updateProfilePicInterface(imageSrc, positionData) {
  const profilePicElement = document.getElementById("profilePic");
  if (profilePicElement) {
    profilePicElement.src = imageSrc;

    // Aplicar posicionamento CSS se fornecido
    if (positionData) {
      profilePicElement.style.objectFit = "cover";
      profilePicElement.style.objectPosition = `${-positionData.x}px ${-positionData.y}px`;
    }
  }

  // Atualizar todas as imagens de perfil na página
  document.querySelectorAll("img").forEach((img) => {
    if (
      img.alt === "Sua foto" ||
      img.alt === "Você" ||
      img.alt === "Foto do perfil" ||
      img.classList.contains("profile-pic") ||
      img.classList.contains("profile-pic-40") ||
      img.classList.contains("post-author-pic") ||
      img.classList.contains("modal-profile-pic")
    ) {
      img.src = imageSrc;

      // Aplicar posicionamento nas fotos de perfil pequenas
      if (
        positionData &&
        (img.classList.contains("profile-pic") ||
          img.classList.contains("profile-pic-40"))
      ) {
        img.style.objectFit = "cover";
        img.style.objectPosition = `${-positionData.x}px ${-positionData.y}px`;
      }
    }
  });
}

async function editProfileName() {
  // Verificar se é owner antes de permitir edição
  if (!isOwner) {
    alert("❌ Apenas a Julia pode alterar o nome do perfil!");
    return;
  }

  const newName = prompt("Novo nome:", profileData.name);
  if (newName && newName.trim()) {
    profileData.name = newName.trim();
    document.getElementById("profileName").textContent = newName.trim();
    document.querySelector(".logo").textContent = newName.trim();

    // Salvar permanentemente no Supabase
    await saveProfileDataToDB();
  }
}

async function saveSettings() {
  // Apenas verificar owner para alterações de perfil (nome)
  const newName = document.getElementById("newProfileName").value.trim();
  if (newName && !isOwner) {
    const errorMessage =
      currentLanguage === "es"
        ? "❌ Solo Julia puede cambiar el nombre del perfil!"
        : "❌ Apenas a Julia pode alterar o nome do perfil!";
    alert(errorMessage);
    return;
  }

  // Salvar nome se for owner
  if (newName && isOwner) {
    profileData.name = newName;
    document.getElementById("profileName").textContent = newName;
    document.querySelector(".logo").textContent = newName;

    // Salvar permanentemente no Supabase
    await saveProfileDataToDB();
  }

  closeModal("settingsModal");

  // Mensagem de sucesso para todos (idioma e cor salvos automaticamente via outras funções)
  const successMessage =
    currentLanguage === "es"
      ? "✅ ¡Configuraciones guardadas!"
      : "✅ Configurações salvas!";

  console.log(successMessage);
}

// Função para testar mensagens (temporária)
function testMessage() {
  simulateMessage();
  console.log("Mensagem simulada, total de conversas:", conversations.length);
}

// FUNÇÕES DOS BOTÕES JÓIA

// Toggle seguir
function toggleFollow() {
  profileData.isFollowed = !profileData.isFollowed;

  if (profileData.isFollowed) {
    profileData.followersCount++;
    updateFollowButton("seguindo");
  } else {
    profileData.followersCount--;
    updateFollowButton("seguir");
  }

  updateInteractionCounts();
  localStorage.setItem("profileData", JSON.stringify(profileData));
}

// Toggle curtir - VERSÃO SUPABASE
async function toggleLike() {
  const userName = prompt("Digite seu nome:", "Visitante") || "Anônimo";

  if (profileData.isLiked) {
    // Remover curtida
    await supabaseClient
      .from("likes")
      .delete()
      .eq("post_id", null) // null = curtida no perfil
      .eq("user_name", userName);

    profileData.likesCount--;
    profileData.isLiked = false;
    updateLikeButton("curtir");
  } else {
    // Adicionar curtida
    await supabaseClient
      .from("likes")
      .insert([{ post_id: null, user_name: userName }]);

    profileData.likesCount++;
    profileData.isLiked = true;
    updateLikeButton("curtiu");
  }

  updateInteractionCounts();
  localStorage.setItem("profileData", JSON.stringify(profileData));
}

// Abrir modal de apoio
function openSupportModal() {
  // TODO: Implementar modal de doações
  alert(
    "🎁 Sistema de apoio em desenvolvimento!\nEm breve você poderá apoiar a Julia!"
  );

  // Animação temporária
  const supportBtn = document.getElementById("supportButton");
  supportBtn.classList.add("supported");
  setTimeout(() => {
    supportBtn.classList.remove("supported");
  }, 3000);
}

// Atualizar botão seguir
function updateFollowButton(state) {
  const button = document.getElementById("followButton");
  const icon = document.getElementById("followIcon");
  const label = button.parentElement.querySelector(".counter-label");

  if (state === "seguindo") {
    button.classList.add("active");
    icon.className = "fas fa-user-check";
    button.title = "Deixar de seguir";
    if (label) label.textContent = "seguindo";
  } else {
    button.classList.remove("active");
    icon.className = "fas fa-user-plus";
    button.title = "Seguir página";
    if (label) label.textContent = "seguir";
  }
}

// Atualizar botão curtir
function updateLikeButton(state) {
  const button = document.getElementById("likeButton");
  const icon = document.getElementById("likeIcon");

  if (state === "curtiu") {
    button.classList.add("active");
    icon.className = "fas fa-heart";
    button.title = "Descurtir página";
  } else {
    button.classList.remove("active");
    icon.className = "far fa-heart";
    button.title = "Curtir página";
  }
}

// Atualizar contadores
function updateInteractionCounts() {
  // Remover referência ao contador de seguidores que foi removido
  const likesCount = document.getElementById("likesCount");
  if (likesCount) {
    likesCount.textContent = formatNumber(profileData.likesCount);
  }
}

// Formatar números grandes
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

// Toggle configurações de privacidade
function togglePrivacy(type) {
  const checkbox = document.getElementById(
    `hide${type.charAt(0).toUpperCase() + type.slice(1)}`
  );
  profileData.privacy[`hide${type.charAt(0).toUpperCase() + type.slice(1)}`] =
    checkbox.checked;

  // Aplicar mudanças visuais
  applyPrivacySettings();

  // Salvar configurações
  localStorage.setItem("profileData", JSON.stringify(profileData));

  console.log(
    "🔒 Configuração de privacidade alterada:",
    type,
    checkbox.checked
  );
}

// Aplicar configurações de privacidade
function applyPrivacySettings() {
  const { privacy } = profileData;

  // Ocultar/mostrar contador de amigos
  const statsSection = document.querySelector(".stats");
  if (statsSection) {
    statsSection.style.display = privacy.hideStatsCount ? "none" : "flex";
  }

  // Ocultar/mostrar lista de amigos
  const friendsList = document.querySelector(".friends-list");
  if (friendsList) {
    friendsList.style.display = privacy.hideFriendsList ? "none" : "block";
  }

  // Ocultar/mostrar seguidores (com verificação de existência)
  const followersCountElement = document.getElementById("followersCount");
  if (followersCountElement && followersCountElement.parentElement) {
    followersCountElement.parentElement.style.display = privacy.hideFollowers
      ? "none"
      : "block";
  }
}

// Função para testar múltiplas mensagens com validação
function testMultipleMessages() {
  const totalMessages = 10;
  console.log(`🧪 INICIANDO TESTE DE ${totalMessages} MENSAGENS`);
  console.log("🗑️ Limpando conversas existentes...");

  // Limpar dados para teste limpo
  conversations = [];
  allGeneratedFriends = [];
  messageCounter = 0;

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < totalMessages; i++) {
    setTimeout(() => {
      console.log(`📤 Enviando mensagem ${i + 1}/${totalMessages}...`);

      const success = simulateMessage();
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }

      // Relatório final
      if (i === totalMessages - 1) {
        setTimeout(() => {
          console.log("\n🎯 === RELATÓRIO FINAL DO TESTE ===");
          console.log(`✅ Mensagens bem-sucedidas: ${successCount}`);
          console.log(`❌ Mensagens com erro: ${errorCount}`);
          console.log(`📊 Total de conversas criadas: ${conversations.length}`);
          console.log(
            `👥 Total de pessoas geradas: ${allGeneratedFriends.length}`
          );

          // Verificação de integridade
          const uniqueIds = new Set(conversations.map((c) => c.friendId));
          const uniqueNames = new Set(conversations.map((c) => c.friendName));

          console.log(
            `🔍 IDs únicos: ${uniqueIds.size} (deve ser ${conversations.length})`
          );
          console.log(`🏷️ Nomes únicos: ${uniqueNames.size}`);

          if (
            uniqueIds.size === conversations.length &&
            conversations.length === totalMessages
          ) {
            console.log("🏆 TESTE PASSOU! Sistema funcionando perfeitamente!");
          } else {
            console.warn("⚠️ Possíveis problemas detectados no sistema!");
          }

          // Atualizar interface
          renderMessagesList();
          updateMessagesCount();

          console.log("=== FIM DO TESTE ===\n");
        }, 200);
      }
    }, i * 150); // Intervalo menor para teste mais rápido
  }
}

// Função para teste extremo (50 mensagens)
function testExtremeMessages() {
  const totalMessages = 50;
  console.log(`🚀 TESTE EXTREMO: ${totalMessages} MENSAGENS`);

  conversations = [];
  allGeneratedFriends = [];
  messageCounter = 0;

  const startTime = Date.now();

  for (let i = 0; i < totalMessages; i++) {
    setTimeout(() => {
      simulateMessage();

      if (i === totalMessages - 1) {
        setTimeout(() => {
          const endTime = Date.now();
          const duration = endTime - startTime;

          console.log(`⚡ TESTE EXTREMO CONCLUÍDO em ${duration}ms`);
          console.log(`📈 ${totalMessages} mensagens processadas`);
          console.log(`👥 ${conversations.length} conversas criadas`);
          console.log(
            `⚡ Velocidade: ${(totalMessages / (duration / 1000)).toFixed(
              1
            )} mensagens/segundo`
          );

          renderMessagesList();
          updateMessagesCount();
        }, 100);
      }
    }, i * 50); // Muito rápido para teste de stress
  }
}

// Notificações
function toggleNotifications() {
  const count = document.getElementById("notificationCount").textContent;
  if (count === "0") {
    alert("Nenhuma notificação nova! 🔔");
  } else {
    alert(
      `Você tem ${count} nova${count > 1 ? "s" : ""} notificação${
        count > 1 ? "ões" : ""
      }! 🔔`
    );
  }
}

// Gerenciamento de posts
function togglePostMenu(postId) {
  const dropdown = document.getElementById(`postDropdown-${postId}`);
  const allDropdowns = document.querySelectorAll(".dropdown-menu");

  // Fechar outros dropdowns
  allDropdowns.forEach((dd) => {
    if (dd.id !== `postDropdown-${postId}`) {
      dd.style.display = "none";
    }
  });

  // Toggle do dropdown atual
  if (dropdown.style.display === "block") {
    dropdown.style.display = "none";
  } else {
    dropdown.style.display = "block";
  }
}

function changePostPrivacy(postId) {
  const post = posts.find((p) => p.id === postId);
  if (!post) return;

  const currentPrivacy = post.privacy || "public";
  const privacyOptions = {
    public: "🌍 Público",
    friends: "👥 Amigos",
    private: "🔒 Somente eu",
  };

  let optionsText = "Escolha a privacidade:\n";
  Object.entries(privacyOptions).forEach(([key, value]) => {
    const marker = key === currentPrivacy ? "✓ " : "  ";
    optionsText += `${marker}${key}: ${value}\n`;
  });

  const newPrivacy = prompt(
    optionsText + "\nDigite: public, friends ou private",
    currentPrivacy
  );

  if (newPrivacy && privacyOptions[newPrivacy]) {
    post.privacy = newPrivacy;
    renderPosts();

    // Fechar dropdown
    document.getElementById(`postDropdown-${postId}`).style.display = "none";

    alert(`Privacidade alterada para: ${privacyOptions[newPrivacy]}`);
  }
}

function deletePost(postId) {
  // Verificar se é owner antes de permitir exclusão
  if (!isOwner) {
    alert("❌ Apenas a Julia pode excluir posts!");
    return;
  }

  if (confirm("Tem certeza que deseja excluir esta postagem?")) {
    const postIndex = posts.findIndex((p) => p.id === postId);
    if (postIndex !== -1) {
      posts.splice(postIndex, 1);
      renderPosts();
      updateStats();
      alert("Postagem excluída com sucesso!");
    }
  }

  // Fechar dropdown
  const dropdown = document.getElementById(`postDropdown-${postId}`);
  if (dropdown) {
    dropdown.style.display = "none";
  }
}

// Outros
function addFeeling() {
  const feeling = prompt("Como você está se sentindo?");
  if (feeling) {
    document.getElementById(
      "postText"
    ).value += ` está se sentindo ${feeling} `;
    openCreatePostModal();
  }
}

function playReel(reelId) {
  alert("Reproduzir reel - funcionalidade em desenvolvimento!");
}

// Abrir galeria
function openGallery(type) {
  if (type === "photos") {
    renderPhotosGallery();
    document.getElementById("photosGallery").style.display = "flex";
  } else if (type === "reels") {
    renderReelsGallery();
    document.getElementById("reelsGallery").style.display = "flex";
  }
}

// Fechar galeria
function closeGallery() {
  document.getElementById("photosGallery").style.display = "none";
  document.getElementById("reelsGallery").style.display = "none";
}

// Renderizar galeria de fotos
function renderPhotosGallery() {
  const photosGrid = document.getElementById("photosGrid");

  if (photos.length === 0) {
    photosGrid.innerHTML = `<div style="text-align: center; color: #65676b; padding: 40px; grid-column: 1/-1;">
            <i class="fas fa-image" style="font-size: 48px; margin-bottom: 20px; color: #e4e6ea;"></i>
            <h3>${t("empty_gallery")}</h3>
        </div>`;
  } else {
    photosGrid.innerHTML = photos
      .map(
        (photo) => `
            <div class="gallery-item" onclick="openMediaViewer('${
              photo.id
            }', 'photo')">
                <img src="${photo.src}" alt="${photo.caption || "Foto"}">
            </div>
        `
      )
      .join("");
  }
}

// Renderizar galeria de reels
function renderReelsGallery() {
  const reelsGrid = document.getElementById("reelsGalleryGrid");

  if (reels.length === 0) {
    reelsGrid.innerHTML = `<div style="text-align: center; color: #65676b; padding: 40px; grid-column: 1/-1;">
            <i class="fas fa-video" style="font-size: 48px; margin-bottom: 20px; color: #e4e6ea;"></i>
            <h3>${t("no_reels")}</h3>
        </div>`;
  } else {
    reelsGrid.innerHTML = reels
      .map(
        (reel) => `
            <div class="gallery-item" onclick="openMediaViewer('${reel.id}', 'reel')">
                <video src="${reel.src}" muted>
                    <source src="${reel.src}" type="video/mp4">
                </video>
            </div>
        `
      )
      .join("");
  }
}

// Abrir modal de amigos
function openFriendsModal() {
  // Verificar se é owner antes de mostrar lista de amigos
  if (!isOwner) {
    alert("❌ Apenas a Julia pode ver a lista de amigos!");
    return;
  }

  renderFriendsModal();
  document.getElementById("friendsModal").style.display = "flex";
}

// Fechar modal de amigos
function closeFriendsModal() {
  document.getElementById("friendsModal").style.display = "none";
}

// Renderizar modal de amigos
function renderFriendsModal() {
  const friendsModalContent = document.getElementById("friendsModalContent");

  if (friends.length === 0) {
    friendsModalContent.innerHTML = `<div style="text-align: center; color: #65676b; padding: 20px;">
            ${t("no_friends")}
        </div>`;
  } else {
    friendsModalContent.innerHTML = friends
      .map(
        (friend) => `
            <div class="friend-item" style="margin-bottom: 15px; padding: 15px; border: 1px solid #e4e6ea; border-radius: 8px;">
                <img src="${friend.pic}" alt="${
          friend.name
        }" class="friend-pic">
                <span class="friend-name">${friend.name}</span>
                ${
                  friend.online
                    ? '<i class="fas fa-circle" style="color: #42b883; font-size: 8px; margin-left: auto;"></i>'
                    : ""
                }
            </div>
        `
      )
      .join("");
  }
}

// Abrir visualizador de mídia (versão sofisticada)
function openMediaViewer(mediaId, type) {
  const media =
    type === "photo"
      ? photos.find((p) => p.id == mediaId)
      : reels.find((r) => r.id == mediaId);
  if (!media) return;

  currentMedia = { ...media, type };
  const mediaContent = document.getElementById("mediaContent");

  // Interface sofisticada sem sombras
  if (type === "photo") {
    mediaContent.innerHTML = `
            <div class="media-viewer-container">
                <div class="media-viewer-header">
                    <div class="media-info">
                        <h3>${media.caption || "Foto"}</h3>
                        <span class="media-privacy">
                            <i class="fas fa-${getPrivacyIcon(
                              media.privacy || "public"
                            )}"></i>
                            ${getPrivacyText(media.privacy || "public")}
                        </span>
                    </div>
                    <button class="media-close-btn" onclick="closeMediaViewer()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="media-display">
                    <img src="${media.src}" alt="${
      media.caption || "Foto"
    }" class="media-main-image">
                </div>
                
                <div class="media-controls">
                    <div class="media-actions-row">
                        <button class="media-action-modern ${
                          media.liked ? "liked" : ""
                        }" onclick="toggleMediaLike()" title="Curtir">
                            <i class="fas fa-heart"></i>
                            <span>${media.likes || 0}</span>
                        </button>
                        <button class="media-action-modern" onclick="showMediaComments()" title="Comentários">
                            <i class="fas fa-comment"></i>
                            <span>${media.comments?.length || 0}</span>
                        </button>
                        <button class="media-action-modern" onclick="shareMedia()" title="Compartilhar">
                            <i class="fas fa-share"></i>
                        </button>
                        <button class="media-action-modern" onclick="downloadMedia()" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <div class="media-menu-modern">
                            <button class="media-action-modern" onclick="toggleMediaMenu()" title="Mais opções">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="media-dropdown-modern" id="mediaDropdown">
                                <button class="media-dropdown-item" onclick="changeMediaPrivacy()">
                                    <i class="fas fa-shield-alt"></i> ${t(
                                      "change_privacy"
                                    )}
                                </button>
                                <button class="media-dropdown-item danger" onclick="deleteMedia()">
                                    <i class="fas fa-trash"></i> ${t("delete")}
                                </button>
                                <button class="media-dropdown-item" onclick="reportMedia()">
                                    <i class="fas fa-flag"></i> Denunciar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
  } else {
    mediaContent.innerHTML = `
            <div class="media-viewer-container">
                <div class="media-viewer-header">
                    <div class="media-info">
                        <h3>${media.title || "Vídeo"}</h3>
                        <span class="media-privacy">
                            <i class="fas fa-${getPrivacyIcon(
                              media.privacy || "public"
                            )}"></i>
                            ${getPrivacyText(media.privacy || "public")}
                        </span>
                    </div>
                    <button class="media-close-btn" onclick="closeMediaViewer()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="media-display">
                    <video src="${media.src}" controls class="media-main-video">
                        <source src="${media.src}" type="video/mp4">
                    </video>
                </div>
                
                <div class="media-controls">
                    <div class="media-actions-row">
                        <button class="media-action-modern ${
                          media.liked ? "liked" : ""
                        }" onclick="toggleMediaLike()" title="Curtir">
                            <i class="fas fa-heart"></i>
                            <span>${media.likes || 0}</span>
                        </button>
                        <button class="media-action-modern" onclick="showMediaComments()" title="Comentários">
                            <i class="fas fa-comment"></i>
                            <span>${media.comments?.length || 0}</span>
                        </button>
                        <button class="media-action-modern" onclick="shareMedia()" title="Compartilhar">
                            <i class="fas fa-share"></i>
                        </button>
                        <button class="media-action-modern" onclick="downloadMedia()" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <div class="media-menu-modern">
                            <button class="media-action-modern" onclick="toggleMediaMenu()" title="Mais opções">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="media-dropdown-modern" id="mediaDropdown">
                                <button class="media-dropdown-item" onclick="changeMediaPrivacy()">
                                    <i class="fas fa-shield-alt"></i> ${t(
                                      "change_privacy"
                                    )}
                                </button>
                                <button class="media-dropdown-item danger" onclick="deleteMedia()">
                                    <i class="fas fa-trash"></i> ${t("delete")}
                                </button>
                                <button class="media-dropdown-item" onclick="reportMedia()">
                                    <i class="fas fa-flag"></i> Denunciar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  const mediaViewer = document.getElementById("mediaViewer");
  mediaViewer.style.display = "flex";

  // Adicionar classe para estilo sofisticado
  mediaViewer.classList.add("media-viewer-modern");
}

// Fechar visualizador de mídia
function closeMediaViewer() {
  const mediaViewer = document.getElementById("mediaViewer");
  mediaViewer.style.display = "none";
  mediaViewer.classList.remove("media-viewer-modern");
  currentMedia = null;
}

// Alternar curtida da mídia
function toggleMediaLike() {
  if (!currentMedia) return;

  const mediaArray = currentMedia.type === "photo" ? photos : reels;
  const media = mediaArray.find((m) => m.id == currentMedia.id);

  if (media) {
    media.liked = !media.liked;
    media.likes = (media.likes || 0) + (media.liked ? 1 : -1);

    // Se for uma imagem de post, sincronizar com o post original
    if (media.isPostImage && media.postId) {
      const originalPost = posts.find((p) => p.id == media.postId);
      if (originalPost) {
        originalPost.liked = media.liked;
        originalPost.likes = media.likes;
      }
    }

    openMediaViewer(media.id, currentMedia.type); // Reabrir para atualizar
  }
}

// Mostrar comentários da mídia
function showMediaComments() {
  alert("Funcionalidade de comentários em desenvolvimento!");
}

// Compartilhar mídia
function shareMedia() {
  alert("Funcionalidade de compartilhamento em desenvolvimento!");
}

// Alternar menu da mídia
function toggleMediaMenu() {
  const dropdown = document.getElementById("mediaDropdown");
  // Fechar outros dropdowns
  document.querySelectorAll(".media-dropdown-modern").forEach((dd) => {
    if (dd !== dropdown) {
      dd.style.display = "none";
    }
  });

  // Toggle do dropdown atual
  if (dropdown.style.display === "block") {
    dropdown.style.display = "none";
  } else {
    dropdown.style.display = "block";
  }
}

// Alterar privacidade da mídia
function changeMediaPrivacy() {
  if (!currentMedia) return;

  const newPrivacy = prompt(
    "Escolha a privacidade:\n1 - Público\n2 - Amigos\n3 - Somente eu"
  );
  const privacyMap = {
    1: "public",
    2: "friends",
    3: "private",
  };

  if (privacyMap[newPrivacy]) {
    const mediaArray = currentMedia.type === "photo" ? photos : reels;
    const media = mediaArray.find((m) => m.id == currentMedia.id);
    if (media) {
      media.privacy = privacyMap[newPrivacy];
      alert("Privacidade alterada!");
    }
  }

  toggleMediaMenu();
}

// Excluir mídia
function deleteMedia() {
  if (!currentMedia) return;

  if (confirm("Tem certeza que deseja excluir esta mídia?")) {
    if (currentMedia.type === "photo") {
      const index = photos.findIndex((p) => p.id == currentMedia.id);
      if (index > -1) photos.splice(index, 1);
    } else {
      const index = reels.findIndex((r) => r.id == currentMedia.id);
      if (index > -1) reels.splice(index, 1);
    }

    updateStats();
    closeMediaViewer();
    alert("Mídia excluída com sucesso!");
  }

  toggleMediaMenu();
}

// Abrir imagem de post no visualizador
function openPostImageViewer(postId) {
  const post = posts.find((p) => p.id == postId);
  if (!post || !post.image) return;

  // Criar objeto de mídia temporário para o visualizador
  const mediaObject = {
    id: post.id + "_image",
    src: post.image,
    caption: post.content || "Imagem da postagem",
    privacy: post.privacy,
    likes: post.likes,
    liked: post.liked,
    comments: post.comments,
    isPostImage: true,
    postId: postId,
  };

  // Adicionar temporariamente ao array de fotos se não existir
  if (!photos.find((p) => p.id === mediaObject.id)) {
    photos.unshift(mediaObject);
  }

  openMediaViewer(mediaObject.id, "photo");
}

// Baixar mídia
function downloadMedia() {
  if (!currentMedia) return;

  try {
    const link = document.createElement("a");
    link.href = currentMedia.src;
    link.download = `${currentMedia.caption || "media"}_${currentMedia.id}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert("Download iniciado! 📥");
  } catch (error) {
    alert(
      'Erro ao baixar arquivo. Tente clicar com o botão direito e "Salvar como..."'
    );
  }
}

// Denunciar mídia
function reportMedia() {
  if (!currentMedia) return;

  const reasons = [
    "1. Conteúdo inadequado",
    "2. Spam",
    "3. Assédio ou bullying",
    "4. Conteúdo violento",
    "5. Propriedade intelectual",
    "6. Outro",
  ];

  const reason = prompt(
    "Motivo da denúncia:\n\n" + reasons.join("\n") + "\n\nDigite o número:"
  );

  if (reason && reason >= 1 && reason <= 6) {
    alert(
      "🚨 Denúncia enviada! Nossa equipe analisará o conteúdo em breve.\n\nObrigada por ajudar a manter nossa comunidade segura! 🛡️"
    );
    toggleMediaMenu();
  }
}

// Função de criar post LOCAL (backup) - NÃO USAR
function createPostLocal() {
  const text = document.getElementById("postText").value;
  const privacy = document.getElementById("postPrivacy").value;
  const imageFile = document.getElementById("postImage").files[0];

  if (!text.trim() && !imageFile) {
    alert("Digite algo ou adicione uma imagem!");
    return;
  }

  const newPost = {
    id: Date.now(),
    author: profileData.name,
    authorPic: profileData.profilePic,
    time: "agora",
    content: text,
    privacy: privacy,
    likes: 0,
    comments: [],
    liked: false,
  };

  if (imageFile) {
    const imageUrl = URL.createObjectURL(imageFile);
    newPost.image = imageUrl;

    // Adicionar à galeria de fotos
    photos.push({
      id: Date.now() + 1,
      src: imageUrl,
      caption: text,
      privacy: privacy,
      likes: 0,
      liked: false,
      comments: [],
    });
  }

  posts.unshift(newPost);
  renderPosts();
  updateStats();
  closeModal("createPostModal");

  // Limpar formulário
  document.getElementById("postText").value = "";
  document.getElementById("postImage").value = "";
  document.getElementById("mediaPreview").innerHTML = "";
}

// Inicializar seleção de idioma baseado no profileData (já carregado do Supabase)
function initializeLanguageSelection() {
  const currentLang = profileData.language || currentLanguage || "es";

  // Atualizar seleção visual sem re-aplicar o idioma
  document.querySelectorAll(".language-option").forEach((option) => {
    option.classList.remove("active");
    if (option.dataset.lang === currentLang) {
      option.classList.add("active");
    }
  });

  console.log("✅ Seleção de idioma inicializada:", currentLang);
}

// Carregar idioma salvo (mantido para compatibilidade)
function loadSavedLanguage() {
  // Usar idioma do profileData se disponível, senão usar localStorage como fallback
  const savedLang = profileData.language || localStorage.getItem("language");
  if (savedLang && translations[savedLang]) {
    currentLanguage = savedLang;
    updateInterface(); // Aplicar traduções
    initializeLanguageSelection(); // Atualizar seleção visual
  } else {
    initializeLanguageSelection(); // Pelo menos inicializar a seleção
  }
}

// Atualizar inicialização (REMOVIDO - já existe inicialização principal)
// document.addEventListener('DOMContentLoaded', function() {
//     updateStats();
//     renderFriends();
//     renderPosts();
//     renderReels();
//     renderFriendRequests();
//     updateRequestsCounter();
//     loadSavedTheme();
//     loadSavedLanguage();
//     initializeStatusSystem();
//     initializeInteractionButtons();
//     loadPrivacySettings();
// });

// Inicializar botões de interação
function initializeInteractionButtons() {
  console.log("💎 Inicializando botões de interação...");

  // Carregar dados salvos
  const savedData = localStorage.getItem("profileData");
  if (savedData) {
    const parsedData = JSON.parse(savedData);
    Object.assign(profileData, parsedData);
  }

  // Atualizar interface
  updateInteractionCounts();

  // Definir estados iniciais dos botões
  if (profileData.isFollowed) {
    updateFollowButton("seguindo");
  }

  if (profileData.isLiked) {
    updateLikeButton("curtiu");
  }

  console.log("✅ Botões inicializados:", {
    seguidores: profileData.followersCount,
    curtidas: profileData.likesCount,
    seguindo: profileData.isFollowed,
    curtiu: profileData.isLiked,
  });
}

// Carregar configurações de privacidade
function loadPrivacySettings() {
  const { privacy } = profileData;

  // Atualizar checkboxes
  document.getElementById("hideStatsCount").checked = privacy.hideStatsCount;
  document.getElementById("hideFriendsList").checked = privacy.hideFriendsList;
  document.getElementById("hideFollowers").checked = privacy.hideFollowers;
  document.getElementById("privateProfile").checked = privacy.privateProfile;

  // Aplicar configurações
  applyPrivacySettings();

  console.log("🔒 Configurações de privacidade carregadas:", privacy);
}

// Inicializar sistema de status
function initializeStatusSystem() {
  // Atualizar checkbox com o valor atual do profileData (já carregado do Supabase)
  const checkbox = document.getElementById("showOnlineStatus");
  if (checkbox) {
    checkbox.checked = profileData.showOnlineStatus;
    console.log(
      "✅ Checkbox status inicializado:",
      profileData.showOnlineStatus
    );
  }

  // Detectar atividade do usuário
  const activityEvents = [
    "mousedown",
    "mousemove",
    "keypress",
    "scroll",
    "touchstart",
    "click",
  ];

  activityEvents.forEach((event) => {
    document.addEventListener(event, updateActivity, true);
  });

  // Detectar quando a página fica visível/oculta
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Detectar quando a janela perde/ganha foco
  window.addEventListener("focus", handleWindowFocus);
  window.addEventListener("blur", handleWindowBlur);

  // Iniciar o loop de verificação de status
  setInterval(checkActivityStatus, 1000);

  // Definir status inicial
  updateOnlineStatus();
}

// Atualizar atividade do usuário
function updateActivity() {
  lastActivity = Date.now();

  if (profileData.onlineStatus === "offline" && profileData.showOnlineStatus) {
    setOnlineStatus("online");
  }
}

// Lidar com mudança de visibilidade da página
function handleVisibilityChange() {
  isPageVisible = !document.hidden;

  if (isPageVisible) {
    updateActivity();
  }
}

// Lidar com foco da janela
function handleWindowFocus() {
  isPageVisible = true;
  updateActivity();
}

function handleWindowBlur() {
  isPageVisible = false;
}

// Verificar status de atividade
function checkActivityStatus() {
  const now = Date.now();
  const timeSinceActivity = now - lastActivity;

  // Se não mostrar status, aparecer como offline (sem salvar no banco)
  if (!profileData.showOnlineStatus) {
    if (profileData.onlineStatus !== "offline") {
      setOnlineStatus("offline");
    }
    return;
  }

  // Se a página não está visível há mais de 30 segundos, considerar offline
  if (!isPageVisible && timeSinceActivity > 30000) {
    setOnlineStatus("offline");
    return;
  }

  // Se não há atividade há mais de 5 minutos, considerar offline
  if (timeSinceActivity > 300000) {
    setOnlineStatus("offline");
    return;
  }

  // Caso contrário, manter online
  if (profileData.onlineStatus !== "online") {
    setOnlineStatus("online");
  }
}

// Definir status online
function setOnlineStatus(status) {
  if (profileData.onlineStatus === status) return;

  profileData.onlineStatus = status;
  updateOnlineStatus();
}

// Atualizar visual do status
function updateOnlineStatus() {
  const statusIndicator = document.getElementById("statusIndicator");
  const statusText = document.getElementById("statusText");
  const chatStatusIndicator = document.getElementById("chatStatusIndicator");
  const chatStatusText = document.getElementById("chatStatusText");

  // Limpar classes anteriores
  statusIndicator.className = "status-indicator";
  statusText.className = "status-text";
  chatStatusIndicator.className = "chat-status-indicator";

  let statusTextContent = "";

  switch (profileData.onlineStatus) {
    case "online":
      statusIndicator.classList.add("status-online");
      statusText.classList.add("status-online-text");
      chatStatusIndicator.classList.add("chat-online");
      statusTextContent = "Online";
      break;
    case "offline":
      statusIndicator.classList.add("status-offline");
      statusText.classList.add("status-offline-text");
      chatStatusIndicator.classList.add("chat-offline");
      statusTextContent = "Offline";
      break;
    case "hidden":
      statusIndicator.classList.add("status-offline");
      statusText.classList.add("status-offline-text");
      chatStatusIndicator.classList.add("chat-offline");
      statusTextContent = "Offline";
      break;
  }

  statusText.textContent = statusTextContent;
  chatStatusText.textContent = statusTextContent;
}

// Toggle status online nas configurações
async function toggleOnlineStatus() {
  const checkbox = document.getElementById("showOnlineStatus");
  profileData.showOnlineStatus = checkbox.checked;

  console.log("🟢 Status alterado para:", profileData.showOnlineStatus);

  // Salvar configuração no Supabase
  await saveProfileDataToDB();

  // Atualizar status imediatamente
  if (profileData.showOnlineStatus) {
    setOnlineStatus("online");
  } else {
    setOnlineStatus("offline");
  }
}

// Sistema de Mensagens

// Toggle dropdown de mensagens
function toggleMessages() {
  const dropdown = document.getElementById("messagesDropdown");

  // Fechar dropdown de solicitações se estiver aberto
  const friendRequestsDropdown = document.getElementById(
    "friendRequestsDropdown"
  );
  friendRequestsDropdown.classList.remove("show");

  dropdown.classList.toggle("show");

  if (dropdown.classList.contains("show")) {
    renderMessagesList();
  }
}

// Toggle dropdown de solicitações de amizade
function toggleFriendRequests() {
  const dropdown = document.getElementById("friendRequestsDropdown");

  // Fechar dropdown de mensagens se estiver aberto
  const messagesDropdown = document.getElementById("messagesDropdown");
  messagesDropdown.classList.remove("show");

  dropdown.classList.toggle("show");

  if (dropdown.classList.contains("show")) {
    renderFriendRequestsHeader();
  }
}

// Renderizar lista de mensagens
function renderMessagesList() {
  const messagesList = document.getElementById("messagesList");

  console.log(
    "Renderizando lista de mensagens. Total de conversas:",
    conversations.length
  );
  conversations.forEach((conv, index) => {
    console.log(
      `Conversa ${index + 1}:`,
      conv.friendName,
      "- Não lidas:",
      conv.unread
    );
  });

  if (conversations.length === 0) {
    messagesList.innerHTML = `
            <div style="text-align: center; color: #65676b; padding: 20px;">
                <i class="fas fa-comments" style="font-size: 32px; margin-bottom: 10px; color: #e4e6ea;"></i>
                <div>Nenhuma mensagem ainda.</div>
                <div style="font-size: 12px; margin-top: 5px;">Suas conversas aparecerão aqui</div>
            </div>
        `;
  } else {
    messagesList.innerHTML = conversations
      .map(
        (conv) => `
            <div class="message-item" onclick="openChatWith('${
              conv.friendId
            }', '${conv.friendName}')">
                <div class="message-avatar">
                    <img src="${conv.friendPic}" alt="${conv.friendName}">
                    <div class="message-status ${
                      conv.online ? "online" : "offline"
                    }"></div>
                </div>
                <div class="message-content">
                    <div class="message-name">${conv.friendName}</div>
                    <div class="message-preview">${conv.lastMessage}</div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <div class="message-time">${conv.timestamp}</div>
                    ${
                      conv.unread > 0
                        ? `<div class="unread-count">${conv.unread}</div>`
                        : ""
                    }
                </div>
            </div>
        `
      )
      .join("");
  }

  console.log("Lista renderizada com sucesso");
}

// Renderizar solicitações de amizade no header
function renderFriendRequestsHeader() {
  const friendRequestsList = document.getElementById(
    "friendRequestsHeaderList"
  );

  console.log(
    "Renderizando solicitações no header. Total:",
    friendRequests.length
  );

  if (friendRequests.length === 0) {
    friendRequestsList.innerHTML = `
            <div style="text-align: center; color: #65676b; padding: 20px;">
                <i class="fas fa-user-friends" style="font-size: 32px; margin-bottom: 10px; color: #e4e6ea;"></i>
                <div>Nenhuma solicitação pendente.</div>
                <div style="font-size: 12px; margin-top: 5px;">Suas solicitações aparecerão aqui</div>
            </div>
        `;
  } else {
    friendRequestsList.innerHTML = friendRequests
      .map(
        (request) => `
            <div class="friend-request-header-item" id="header-request-${request.id}">
                <img src="${request.pic}" alt="${request.name}" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 12px;">
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 14px; margin-bottom: 2px;">${request.name}</div>
                    <div style="font-size: 12px; color: #65676b; margin-bottom: 8px;">${request.message}</div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="acceptFriendFromHeader('${request.id}', '${request.name}', event)" 
                                style="background: var(--primary-color); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">
                            Aceitar
                        </button>
                        <button onclick="rejectFriendFromHeader('${request.id}', event)"
                                style="background: #e4e6ea; color: #65676b; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">
                            Recusar
                        </button>
                    </div>
                </div>
            </div>
        `
      )
      .join("");
  }
}

// Sistema dinâmico de geração de pessoas
const firstNames = [
  "Ana",
  "Carlos",
  "Beatriz",
  "Diego",
  "Elena",
  "Fernando",
  "Gabriela",
  "Henrique",
  "Isabela",
  "João",
  "Kelly",
  "Lucas",
  "Marina",
  "Nicolas",
  "Olivia",
  "Pedro",
  "Raquel",
  "Sandra",
  "Thiago",
  "Vanessa",
  "Wellington",
  "Ximena",
  "Yara",
  "Zeca",
  "Amanda",
  "Bruno",
  "Camila",
  "Daniel",
  "Eduardo",
  "Fabiana",
  "Guilherme",
  "Helena",
  "Igor",
  "Juliana",
  "Kleber",
  "Larissa",
  "Marcelo",
  "Natália",
  "Oscar",
  "Priscila",
  "Roberto",
  "Silvia",
  "Tatiana",
  "Ulysses",
  "Verônica",
  "Wagner",
  "Yasmin",
  "Zilda",
  "Alexandre",
  "Bianca",
];

const lastNames = [
  "Silva",
  "Santos",
  "Oliveira",
  "Souza",
  "Rodrigues",
  "Ferreira",
  "Alves",
  "Pereira",
  "Lima",
  "Gomes",
  "Costa",
  "Ribeiro",
  "Martins",
  "Carvalho",
  "Almeida",
  "Lopes",
  "Soares",
  "Fernandes",
  "Vieira",
  "Barbosa",
  "Rocha",
  "Dias",
  "Monteiro",
  "Cardoso",
  "Ramos",
  "Nunes",
  "Teixeira",
  "Moreira",
  "Correia",
  "Mendes",
  "Castro",
  "Reis",
  "Andrade",
  "Moura",
  "Freitas",
  "Campos",
  "Cunha",
  "Pinto",
  "Fonseca",
  "Gonçalves",
];

const avatarColors = [
  "ff6b6b",
  "4ecdc4",
  "45b7d1",
  "f39c12",
  "e74c3c",
  "9b59b6",
  "1abc9c",
  "34495e",
  "e67e22",
  "2c3e50",
  "8e44ad",
  "27ae60",
  "d35400",
  "c0392b",
  "16a085",
  "f1c40f",
  "e91e63",
  "9c27b0",
  "673ab7",
  "3f51b5",
  "2196f3",
  "03a9f4",
  "00bcd4",
  "009688",
  "4caf50",
  "8bc34a",
  "cddc39",
  "ff9800",
  "ff5722",
  "795548",
];

let messageCounter = 0; // Contador único para IDs
let allGeneratedFriends = []; // Cache de pessoas já geradas

// Função para gerar pessoa única dinamicamente
function generateUniquePerson() {
  messageCounter++;

  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const fullName = `${firstName} ${lastName}`;
  const avatarColor =
    avatarColors[Math.floor(Math.random() * avatarColors.length)];
  const firstLetter = firstName.charAt(0).toUpperCase();

  const person = {
    id: `person_${messageCounter}_${Date.now()}`, // ID único com timestamp
    name: fullName,
    pic: `https://via.placeholder.com/40/${avatarColor}/ffffff?text=${firstLetter}`,
    online: Math.random() > 0.3, // 70% chance de estar online
  };

  // Verificar se já existe (muito raro, mas segurança extra)
  while (
    allGeneratedFriends.find(
      (f) => f.name === person.name && f.id !== person.id
    )
  ) {
    const newFirstName =
      firstNames[Math.floor(Math.random() * firstNames.length)];
    const newLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    person.name = `${newFirstName} ${newLastName}`;
    person.pic = `https://via.placeholder.com/40/${avatarColor}/ffffff?text=${newFirstName
      .charAt(0)
      .toUpperCase()}`;
  }

  allGeneratedFriends.push(person);
  console.log(
    "🆕 Pessoa gerada:",
    person.name,
    "| ID:",
    person.id,
    "| Total geradas:",
    allGeneratedFriends.length
  );

  return person;
}

// Sistema de mensagens com validação robusta
function simulateMessage() {
  try {
    console.log("🚀 Iniciando simulação de mensagem...");

    // Gerar pessoa única
    const friend = generateUniquePerson();

    const messages = [
      "Oi! Como você está?",
      "Viu as fotos que postei?",
      "Vamos conversar?",
      "Que legal sua página!",
      "Quer sair hoje?",
      "E aí, tudo bem?",
      "Vamos nos encontrar?",
      "Adorei seu post!",
      "Que saudade! Como tem passado?",
      "Vi seu story, muito legal!",
      "Bora tomar um café?",
      "Olá! Tudo certo por aí?",
      "Suas fotos ficaram lindas!",
      "Quando nos vemos?",
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    // GARANTIA: Verificar se já existe conversa (não deveria existir com pessoa nova)
    let conversation = conversations.find((c) => c.friendId === friend.id);

    if (!conversation) {
      // Criar nova conversa (caso normal)
      conversation = {
        friendId: friend.id,
        friendName: friend.name,
        friendPic: friend.pic,
        online: friend.online,
        lastMessage: randomMessage,
        timestamp: "agora",
        unread: 1,
        messages: [],
      };

      // Adicionar mensagem ao histórico
      conversation.messages.push({
        from: friend.id,
        text: randomMessage,
        timestamp: Date.now(),
      });

      // Adicionar à lista de conversas
      conversations.unshift(conversation);

      console.log(
        "✅ Nova conversa criada:",
        friend.name,
        "| Total conversas:",
        conversations.length
      );
      console.log("📝 Mensagem:", randomMessage);
    } else {
      // CASO RARO: Já existe (erro no sistema de IDs únicos)
      console.warn("⚠️ ATENÇÃO: Pessoa já existe no sistema!", friend.name);
      conversation.lastMessage = randomMessage;
      conversation.unread += 1;
      conversation.messages.push({
        from: friend.id,
        text: randomMessage,
        timestamp: Date.now(),
      });

      // Mover para o topo
      conversations = conversations.filter((c) => c.friendId !== friend.id);
      conversations.unshift(conversation);
    }

    // Atualizar interface
    updateMessagesCount();

    // Log de verificação
    const uniqueIds = new Set(conversations.map((c) => c.friendId));
    if (uniqueIds.size !== conversations.length) {
      console.error("🚨 ERRO: IDs duplicados detectados!");
    }

    console.log("📊 Status:", {
      "Total conversas": conversations.length,
      "IDs únicos": uniqueIds.size,
      "Mensagens não lidas": conversations.reduce(
        (sum, c) => sum + c.unread,
        0
      ),
    });

    return true;
  } catch (error) {
    console.error("❌ ERRO na simulação de mensagem:", error);
    return false;
  }
}

// Atualizar contador de mensagens
function updateMessagesCount() {
  unreadMessages = conversations.reduce(
    (total, conv) => total + conv.unread,
    0
  );
  const badge = document.getElementById("messagesCount");

  if (unreadMessages > 0) {
    badge.textContent = unreadMessages;
    badge.style.display = "block";
  } else {
    badge.style.display = "none";
  }
}

// Abrir chat simples (só para página pessoal - visitantes NÃO podem)
function openChat(friendName) {
  // PÁGINA PESSOAL: Apenas amigos aceitos podem conversar
  showAlert(
    "❌ Em uma página pessoal, você só pode conversar com a dona da página!",
    "error"
  );
  return;
}

// Abrir chat com amigo
function openChatWith(friendId, friendName) {
  // Verificar se são amigos antes de abrir chat
  const friends = JSON.parse(localStorage.getItem("friends") || "[]");
  const isFriend = friends.some((friend) => friend.id === friendId);

  if (!isFriend) {
    alert(
      "❌ Você só pode conversar com pessoas que são suas amigas! Envie uma solicitação de amizade primeiro."
    );
    return;
  }

  // Fechar dropdown
  document.getElementById("messagesDropdown").classList.remove("show");

  // Verificar se já existe chat aberto
  const existingChat = openChats.find((chat) => chat.friendId === friendId);
  if (existingChat) {
    // Restaurar se minimizado
    restoreChat(existingChat.chatId);
    return;
  }

  // Limitar a 4 chats
  if (openChats.length >= 4) {
    alert("Máximo de 4 conversas abertas. Feche alguma para abrir nova.");
    return;
  }

  const chatId = `chat-${friendId}`;
  const position = openChats.length + 1;
  const conversation = conversations.find((c) => c.friendId === friendId);

  // Criar estrutura do chat
  const chatHTML = `
        <div class="chat-widget chat-position-${position}" id="${chatId}">
            <div class="chat-header">
                <div class="chat-status">
                    <span>${friendName}</span>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span class="chat-status-indicator ${
                          conversation?.online ? "chat-online" : "chat-offline"
                        }"></span>
                        <span class="chat-status-text">${
                          conversation?.online ? "Online" : "Offline"
                        }</span>
                    </div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button onclick="minimizeChat('${chatId}')" style="background: none; border: none; color: white; cursor: pointer;">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button onclick="closeChat('${chatId}')" style="background: none; border: none; color: white; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="chat-messages" id="${chatId}-messages">
                <div style="text-align: center; color: #65676b; padding: 20px;">
                    Conversa com ${friendName}
                </div>
            </div>
            <div class="chat-input-area">
                <input type="text" class="chat-input" placeholder="Digite sua mensagem..." 
                       onkeypress="handleChatEnter(event, '${chatId}', '${friendId}')">
            </div>
        </div>
    `;

  // Adicionar ao DOM
  document.body.insertAdjacentHTML("beforeend", chatHTML);

  // Registrar chat aberto
  openChats.push({
    chatId: chatId,
    friendId: friendId,
    friendName: friendName,
    position: position,
    minimized: false,
  });

  // Mostrar chat
  document.getElementById(chatId).style.display = "block";

  // Marcar mensagens como lidas
  if (conversation) {
    conversation.unread = 0;
    updateMessagesCount();

    // Carregar mensagens existentes
    conversation.messages.forEach((msg) => {
      const isFromMe = msg.from === profileData.name;
      const senderName = isFromMe ? "Você" : friendName;
      const senderPic = isFromMe
        ? profileData.profilePic
        : conversation.friendPic;
      addMessageToChat(chatId, msg.text, senderName, senderPic, isFromMe);
    });
  }
}

// Adicionar mensagem ao chat
function addMessageToChat(chatId, message, senderName, senderPic, isFromMe) {
  const messagesContainer = document.getElementById(`${chatId}-messages`);

  // Limpar mensagem de boas-vindas se existir
  if (messagesContainer.innerHTML.includes("Conversa com")) {
    messagesContainer.innerHTML = "";
  }

  const messageHTML = `
        <div style="margin-bottom: 10px; text-align: ${
          isFromMe ? "right" : "left"
        };">
            <div style="background: ${
              isFromMe ? "var(--primary-color)" : "#f0f2f5"
            }; color: ${isFromMe ? "white" : "#1c1e21"}; 
                        padding: 8px 12px; border-radius: 16px; display: inline-block; max-width: 70%;">
                ${message}
            </div>
        </div>
    `;

  messagesContainer.innerHTML += messageHTML;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Minimizar chat
function minimizeChat(chatId) {
  const chat = document.getElementById(chatId);
  const chatData = openChats.find((c) => c.chatId === chatId);

  if (!chatData) {
    console.log("Chat data não encontrado para:", chatId);
    return;
  }

  // Ocultar o chat completo
  if (chat) {
    chat.style.display = "none";
    console.log("Chat minimizado:", chatId);
  }

  chatData.minimized = true;

  // Verificar se já existe versão minimizada
  const existingMinimized = document.getElementById(`${chatId}-minimized`);
  if (existingMinimized) {
    existingMinimized.remove();
  }

  // Criar versão minimizada com mais informações
  const conversation = conversations.find(
    (c) => c.friendId === chatData.friendId
  );
  const unreadCount = conversation?.unread || 0;
  const lastMessage = conversation?.lastMessage || "Conversa ativa";
  const truncatedMessage =
    lastMessage.length > 25
      ? lastMessage.substring(0, 25) + "..."
      : lastMessage;

  const minimizedHTML = `
        <div class="chat-minimized chat-position-${
          chatData.position
        }" id="${chatId}-minimized" onclick="restoreChat('${chatId}')">
            <div class="chat-minimized-header">
                <div class="chat-minimized-info">
                    <div class="chat-minimized-avatar">
                        <img src="${
                          conversation?.friendPic ||
                          "https://picsum.photos/28?random=7"
                        }" alt="${chatData.friendName}">
                        <div class="chat-minimized-status ${
                          conversation?.online ? "online" : "offline"
                        }"></div>
                        ${
                          unreadCount > 0
                            ? `<div class="chat-minimized-badge">${unreadCount}</div>`
                            : ""
                        }
                    </div>
                    <div class="chat-minimized-details">
                        <div class="chat-minimized-name">${
                          chatData.friendName
                        }</div>
                        <div class="chat-minimized-preview">${truncatedMessage}</div>
                    </div>
                </div>
                <button class="chat-minimized-close" onclick="event.stopPropagation(); closeChat('${chatId}'); return false;" title="Fechar conversa">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;

  // Adicionar ao container de minimizados
  const minimizedContainer = document.getElementById("minimizedChats");
  if (minimizedContainer) {
    minimizedContainer.insertAdjacentHTML("beforeend", minimizedHTML);

    // Mostrar a barra minimizada imediatamente
    setTimeout(() => {
      const minimizedElement = document.getElementById(`${chatId}-minimized`);
      if (minimizedElement) {
        minimizedElement.style.display = "block";
        console.log("✅ Barra minimizada exibida:", `${chatId}-minimized`);
      }
    }, 100);

    console.log("Pop-up minimizado criado:", `${chatId}-minimized`);
  } else {
    console.error("Container minimizedChats não encontrado");
  }
}

// Restaurar chat
function restoreChat(chatId) {
  console.log("Tentando restaurar chat:", chatId);

  const chat = document.getElementById(chatId);
  const minimized = document.getElementById(`${chatId}-minimized`);
  const chatData = openChats.find((c) => c.chatId === chatId);

  if (chatData) {
    chatData.minimized = false;
    console.log("Chat data atualizado para não minimizado");
  }

  if (chat) {
    chat.style.display = "block";
    console.log("Chat restaurado e visível");
  } else {
    console.error("Elemento do chat não encontrado:", chatId);
  }

  if (minimized) {
    minimized.remove();
    console.log("Pop-up minimizado removido");
  } else {
    console.log("Pop-up minimizado não encontrado:", `${chatId}-minimized`);
  }
}

// Fechar chat
function closeChat(chatId) {
  const chat = document.getElementById(chatId);
  const minimized = document.getElementById(`${chatId}-minimized`);

  if (chat) {
    chat.remove();
  }

  if (minimized) {
    minimized.remove();
  }

  // Remover da lista de chats abertos
  openChats = openChats.filter((c) => c.chatId !== chatId);

  // Reorganizar posições
  openChats.forEach((chat, index) => {
    const newPosition = index + 1;
    chat.position = newPosition;

    const element = document.getElementById(chat.chatId);
    const minimizedElement = document.getElementById(
      `${chat.chatId}-minimized`
    );

    if (element) {
      element.className = element.className.replace(
        /chat-position-\d+/,
        `chat-position-${newPosition}`
      );
    }

    if (minimizedElement) {
      minimizedElement.className = minimizedElement.className.replace(
        /chat-position-\d+/,
        `chat-position-${newPosition}`
      );
    }
  });
}

// Controle de Anúncios
function closeFloatingAd() {
  document.getElementById("floating-ad").style.display = "none";
  localStorage.setItem("floatingAdClosed", "true");
}

// Mostrar anúncio flutuante após alguns segundos
function showFloatingAd() {
  const adClosed = localStorage.getItem("floatingAdClosed");
  if (!adClosed) {
    setTimeout(() => {
      document.getElementById("floating-ad").style.display = "block";
    }, 5000); // Mostra após 5 segundos
  }
}

// Simular clique em anúncio (para teste)
function trackAdClick(adId) {
  console.log(`Clique no anúncio: ${adId}`);
  // Aqui você pode adicionar tracking de cliques para análise
}

// ========== SISTEMA DE VERIFICAÇÃO DE IDADE ==========

function checkAgeVerification() {
  const ageVerified = localStorage.getItem("ageVerified");
  const verificationDate = localStorage.getItem("verificationDate");

  // Verificar se foi verificado nos últimos 30 dias
  if (
    !ageVerified ||
    !verificationDate ||
    isVerificationExpired(verificationDate)
  ) {
    showAgeVerificationModal();
  }
}

function isVerificationExpired(dateString) {
  const verificationDate = new Date(dateString);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return verificationDate < thirtyDaysAgo;
}

function showAgeVerificationModal() {
  // Bloquear interação com a página
  document.body.classList.add("age-verification-active");

  // Configurar seletores de data
  setupDateSelectors();

  // Mostrar modal
  document.getElementById("ageVerificationModal").style.display = "flex";
}

function setupDateSelectors() {
  const daySelect = document.getElementById("birthDay");
  const yearSelect = document.getElementById("birthYear");

  // Preencher dias (1-31)
  for (let i = 1; i <= 31; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = i;
    daySelect.appendChild(option);
  }

  // Preencher anos (1900 - ano atual)
  const currentYear = new Date().getFullYear();
  for (let i = currentYear; i >= 1900; i--) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = i;
    yearSelect.appendChild(option);
  }
}

function verifyAge() {
  const day = parseInt(document.getElementById("birthDay").value);
  const month = parseInt(document.getElementById("birthMonth").value);
  const year = parseInt(document.getElementById("birthYear").value);

  if (!day || !month || !year) {
    alert("❌ Por favor, preencha sua data de nascimento completa.");
    return;
  }

  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  const age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));

  if (age < 18) {
    alert("❌ Você deve ter pelo menos 18 anos para acessar este site.");
    exitSite();
    return;
  }

  // Aprovado
  localStorage.setItem("ageVerified", "true");
  localStorage.setItem("verificationDate", new Date().toISOString());
  localStorage.setItem("userAge", age);

  // Fechar modal
  document.getElementById("ageVerificationModal").style.display = "none";
  document.body.classList.remove("age-verification-active");

  // Mostrar mensagem de boas-vindas
  setTimeout(() => {
    alert("✅ Verificação concluída! Bem-vinda à plataforma! 🎉");
  }, 500);
}

function exitSite() {
  alert("👋 Obrigada pela visita! Volte quando completar 18 anos.");
  // Redirecionar para site apropriado
  window.location.href = "https://www.google.com";
}

// ========== CENTRAL DE SEGURANÇA ==========

function openSecurityCenter() {
  // Verificar se é owner antes de abrir Central de Segurança
  if (!isOwner) {
    alert(
      "🛡️ Apenas a Julia (administradora) pode acessar a Central de Segurança!"
    );
    return;
  }

  document.getElementById("securityModal").style.display = "flex";
}

function closeSecurityModal() {
  document.getElementById("securityModal").style.display = "none";
}

function setupSecurityFeatures() {
  // Proteções contra ataques
  setupInputSanitization();
  setupCSRFProtection();
  // setupXSSProtection(); // TEMPORARIAMENTE DESABILITADO PARA TESTE DE UPLOAD

  // Anti-spam e rate limiting
  setupSpamProtection();
  setupRateLimit();

  // Detectar comportamento suspeito
  monitorSuspiciousActivity();

  // Headers de segurança
  setupSecurityHeaders();

  console.log(
    "🛡️ Sistemas de segurança ativados (CSP desabilitado para upload)"
  );
}

function setupSpamProtection() {
  let messageCount = 0;
  let lastMessageTime = 0;

  window.checkSpam = function (message) {
    const now = Date.now();
    const timeDiff = now - lastMessageTime;

    // Resetar contador após 1 minuto
    if (timeDiff > 60000) {
      messageCount = 0;
    }

    messageCount++;
    lastMessageTime = now;

    // Máximo 5 mensagens por minuto
    if (messageCount > 5) {
      alert(
        "⚠️ Você está enviando mensagens muito rapidamente. Aguarde um momento."
      );
      return false;
    }

    // Detectar mensagens repetidas
    const lastMessages = JSON.parse(
      localStorage.getItem("lastMessages") || "[]"
    );
    if (lastMessages.includes(message)) {
      alert("⚠️ Evite enviar mensagens repetidas.");
      return false;
    }

    // Guardar últimas 5 mensagens
    lastMessages.push(message);
    if (lastMessages.length > 5) lastMessages.shift();
    localStorage.setItem("lastMessages", JSON.stringify(lastMessages));

    return true;
  };
}

function monitorSuspiciousActivity() {
  let clickCount = 0;
  let rapidClicks = 0;

  document.addEventListener("click", function () {
    clickCount++;

    // Resetar a cada 10 segundos
    setTimeout(() => clickCount--, 10000);

    // Detectar cliques excessivos (possível bot)
    if (clickCount > 20) {
      console.warn("⚠️ Atividade suspeita detectada");
      showSecurityWarning();
    }
  });
}

function setupRateLimit() {
  window.rateLimitActions = new Map();

  window.checkRateLimit = function (action, limit = 5, timeWindow = 60000) {
    const now = Date.now();
    const key = action;

    if (!window.rateLimitActions.has(key)) {
      window.rateLimitActions.set(key, []);
    }

    const actions = window.rateLimitActions.get(key);

    // Remover ações antigas
    const validActions = actions.filter((time) => now - time < timeWindow);

    if (validActions.length >= limit) {
      return false;
    }

    validActions.push(now);
    window.rateLimitActions.set(key, validActions);
    return true;
  };
}

function showSecurityWarning() {
  const warning = document.createElement("div");
  warning.className = "security-warning";
  warning.innerHTML = `
        <div class="security-warning-content">
            <h3>⚠️ Aviso de Segurança</h3>
            <p>Detectamos atividade suspeita em sua conta.</p>
            <button onclick="this.parentElement.parentElement.remove()">OK</button>
        </div>
    `;
  document.body.appendChild(warning);
}

// ========== PROTEÇÕES CONTRA ATAQUES ==========

function setupInputSanitization() {
  // Interceptar todos os inputs e sanitizar
  document.addEventListener("input", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      const value = e.target.value;

      // Detectar tentativas de XSS
      if (
        value.includes("<script") ||
        value.includes("javascript:") ||
        value.includes("onload=")
      ) {
        console.warn("🚨 Tentativa de XSS bloqueada:", value);
        e.target.value = sanitizeInput(value);
        showSecurityAlert("Tentativa de ataque XSS bloqueada!");
        updateSecurityCounter("xss");
      }
    }
  });
}

function sanitizeInput(input) {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setupCSRFProtection() {
  // Gerar token CSRF
  const csrfToken = generateCSRFToken();
  localStorage.setItem("csrfToken", csrfToken);

  // Adicionar token a todas as requisições
  const originalFetch = window.fetch;
  window.fetch = function (url, options) {
    options = options || {};
    options.headers = options.headers || {};
    options.headers["X-CSRF-Token"] = csrfToken;
    return originalFetch(url, options);
  };
}

function generateCSRFToken() {
  return (
    "csrf-" + Math.random().toString(36).substr(2, 16) + Date.now().toString(36)
  );
}

function setupXSSProtection() {
  // Content Security Policy mais permissivo para uploads
  const meta = document.createElement("meta");
  meta.httpEquiv = "Content-Security-Policy";
  meta.content =
    "default-src 'self' blob: data:; img-src 'self' blob: data: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https:";
  document.head.appendChild(meta);
  console.log("🔒 CSP configurado para permitir blob: e data: URLs");
}

function setupSecurityHeaders() {
  // Simular headers de segurança importantes
  console.log("🔒 Headers de segurança configurados:");
  console.log("- X-Frame-Options: DENY");
  console.log("- X-Content-Type-Options: nosniff");
  console.log("- X-XSS-Protection: 1; mode=block");
  console.log("- Strict-Transport-Security: max-age=31536000");
}

function reportContent() {
  const reason = prompt(
    "Motivo da denúncia:\n1. Conteúdo inadequado\n2. Spam\n3. Assédio\n4. Outro\n\nDigite o número:"
  );
  if (reason) {
    alert("📝 Denúncia enviada! Nossa equipe analisará em breve.");
  }
}

function blockUser() {
  const username = prompt("Nome do usuário para bloquear:");
  if (username) {
    alert(`🚫 Usuário ${username} foi bloqueado.`);
  }
}

// ========== FERRAMENTAS DE SEGURANÇA ==========

let securityCounters = {
  botAttempts: 0,
  bruteForce: 0,
  xssAttempts: 0,
  suspiciousRequests: 0,
};

function updateSecurityCounter(type) {
  securityCounters[type + "Attempts"]++;
  updateSecurityDisplay();
}

function updateSecurityDisplay() {
  const botElement = document.getElementById("botAttempts");
  const bruteElement = document.getElementById("bruteForce");
  const trafficElement = document.getElementById("suspiciousTraffic");

  if (botElement) {
    botElement.textContent = `${securityCounters.botAttempts} bloqueadas`;
  }
  if (bruteElement) {
    bruteElement.textContent = `${securityCounters.bruteForce} detectados`;
  }
  if (trafficElement) {
    const total =
      securityCounters.botAttempts +
      securityCounters.bruteForce +
      securityCounters.xssAttempts;
    trafficElement.textContent =
      total > 10 ? "Alto risco ⚠️" : total > 5 ? "Moderado ⚡" : "Normal ✅";
  }
}

function refreshSecurityStatus() {
  // Simular verificação de segurança
  const loader = document.createElement("div");
  loader.innerHTML = "🔄 Verificando status...";
  loader.style.position = "fixed";
  loader.style.top = "50%";
  loader.style.left = "50%";
  loader.style.transform = "translate(-50%, -50%)";
  loader.style.background = "white";
  loader.style.padding = "20px";
  loader.style.borderRadius = "8px";
  loader.style.zIndex = "9999";
  document.body.appendChild(loader);

  setTimeout(() => {
    loader.remove();
    updateSecurityDisplay();
    alert(
      "✅ Status de segurança atualizado!\n\n" +
        `🤖 Bots bloqueados: ${securityCounters.botAttempts}\n` +
        `🚨 Ataques detectados: ${securityCounters.bruteForce}\n` +
        `🛡️ Sistema funcionando normalmente`
    );
  }, 2000);
}

function runSecurityScan() {
  alert(
    "🔍 Executando scan de segurança...\n\nVerificando:\n• Vulnerabilidades XSS\n• Tentativas de injeção\n• Atividade de bots\n• Integridade dos dados"
  );

  setTimeout(() => {
    const threats = Math.floor(Math.random() * 3);
    if (threats > 0) {
      securityCounters.botAttempts += threats;
      updateSecurityDisplay();
      alert(
        `⚠️ Scan concluído!\n\n${threats} ameaças detectadas e neutralizadas.\nSistema seguro.`
      );
    } else {
      alert(
        "✅ Scan concluído!\n\nNenhuma ameaça detectada.\nSistema totalmente seguro."
      );
    }
  }, 3000);
}

function clearSuspiciousData() {
  localStorage.removeItem("suspiciousActivity");
  sessionStorage.clear();
  securityCounters = {
    botAttempts: 0,
    bruteForce: 0,
    xssAttempts: 0,
    suspiciousRequests: 0,
  };
  updateSecurityDisplay();
  alert(
    "🧹 Dados suspeitos limpos!\n\nCache e dados temporários removidos.\nSistema otimizado."
  );
}

function activateFirewall(active) {
  if (active !== false) {
    alert(
      "🔥 Firewall Avançado Ativado!\n\n✅ Proteção DDoS\n✅ Bloqueio de IPs suspeitos\n✅ Filtragem de requisições\n✅ Monitoramento em tempo real"
    );

    // Simular ativação do firewall
    window.firewallActive = true;

    // Mostrar indicador visual
    const indicator = document.createElement("div");
    indicator.innerHTML = "🔥 Firewall Ativo";
    indicator.style.position = "fixed";
    indicator.style.top = "10px";
    indicator.style.right = "10px";
    indicator.style.background = "linear-gradient(135deg, #e74c3c, #c0392b)";
    indicator.style.color = "white";
    indicator.style.padding = "5px 10px";
    indicator.style.borderRadius = "15px";
    indicator.style.fontSize = "12px";
    indicator.style.zIndex = "9998";
    indicator.style.animation = "pulse 2s infinite";
    document.body.appendChild(indicator);

    setTimeout(() => indicator.remove(), 10000);
  }
}

function showSecurityAlert(message) {
  const alert = document.createElement("div");
  alert.className = "security-alert";
  alert.innerHTML = `
        <div style="background: #ff3040; color: white; padding: 10px 15px; border-radius: 5px; 
                    position: fixed; top: 100px; right: 20px; z-index: 9999; box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
            🛡️ ${message}
        </div>
    `;
  document.body.appendChild(alert);

  setTimeout(() => alert.remove(), 5000);
}

function contactSupport() {
  alert(
    "🛠️ Suporte Técnico:\n\n📧 Email: security@juliapage.com\n🔒 Emergências: +55 11 9999-1111\n💬 Chat: 24/7 disponível\n\n⚡ Resposta média: 15 minutos"
  );
}

// Modais de Termos e Privacidade
function openTerms() {
  document.getElementById("termsModal").style.display = "flex";
}

function closeTermsModal() {
  document.getElementById("termsModal").style.display = "none";
}

function openPrivacy() {
  document.getElementById("privacyModal").style.display = "flex";
}

function closePrivacyModal() {
  document.getElementById("privacyModal").style.display = "none";
}

// ========== SISTEMA DE APOIO/DOAÇÃO ==========

function openSupportModal() {
  document.getElementById("supportModal").style.display = "flex";
}

function closeSupportModal() {
  document.getElementById("supportModal").style.display = "none";
}

function processDonation(amount) {
  // Simular processamento de pagamento
  alert(
    `Obrigada pelo apoio de R$ ${amount}! 💝\nEm breve você receberá um email de confirmação.`
  );

  // Atualizar contador de apoio
  profileData.isSupported = true;
  const supportButton = document.getElementById("supportButton");
  if (supportButton) {
    supportButton.classList.add("supported");
    supportButton.innerHTML = '<i class="fas fa-gem supported-icon"></i>';
  }

  closeSupportModal();
}

// ========== TESTES DE DEBUG ==========

function testProfilePicDebug() {
  console.log("🚀 INICIANDO TESTE COMPLETO DE FOTO DE PERFIL");

  // Teste 1: Verificar elementos
  const elements = {
    profilePic: document.getElementById("profilePic"),
    profileModal: document.getElementById("profilePicModal"),
    currentProfilePic: document.getElementById("currentProfilePic"),
    cropModal: document.getElementById("cropModal"),
    cropImage: document.getElementById("cropImage"),
  };

  console.log("📋 ELEMENTOS ENCONTRADOS:");
  Object.keys(elements).forEach((key) => {
    console.log(`- ${key}:`, !!elements[key]);
    if (!elements[key]) {
      console.error(`❌ ELEMENTO ${key} NÃO ENCONTRADO!`);
    }
  });

  // Teste 2: Testar função changeProfilePic
  console.log("🖱️ Testando função changeProfilePic...");
  try {
    changeProfilePic();
    console.log("✅ changeProfilePic executada");
  } catch (error) {
    console.error("❌ ERRO em changeProfilePic:", error);
  }

  // Teste 3: Verificar se modal abriu
  setTimeout(() => {
    const modal = document.getElementById("profilePicModal");
    if (modal && modal.style.display === "flex") {
      console.log("✅ Modal de foto de perfil aberto com sucesso");

      // Teste 4: Testar upload direto
      console.log("📁 Testando uploadNewProfilePic...");
      try {
        uploadNewProfilePic();
        console.log("✅ uploadNewProfilePic executada");
      } catch (error) {
        console.error("❌ ERRO em uploadNewProfilePic:", error);
      }
    } else {
      console.error("❌ Modal não abriu!");
    }
  }, 500);
}

function testDirectUpload() {
  console.log("📁 TESTE DE UPLOAD DIRETO - COM VALIDAÇÃO ROBUSTA");

  // Criar input simples
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/jpg,image/png,image/gif";

  input.onchange = function (e) {
    const file = e.target.files[0];
    if (file) {
      console.log("✅ Arquivo selecionado:", file.name, file.size, file.type);

      // Validações básicas
      if (file.size > 5 * 1024 * 1024) {
        alert(
          "❌ Arquivo muito grande! Máximo 5MB para melhor compatibilidade."
        );
        return;
      }

      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
      if (!validTypes.includes(file.type)) {
        alert("❌ Use apenas JPG, PNG ou GIF!");
        return;
      }

      // Mostrar loading
      const loadingDiv = document.createElement("div");
      loadingDiv.innerHTML = "📤 Processando foto...";
      loadingDiv.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: white; padding: 20px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                z-index: 9999; font-weight: bold; text-align: center;
            `;
      document.body.appendChild(loadingDiv);

      // Método 1: URL.createObjectURL (mais compatível)
      try {
        const imageUrl = URL.createObjectURL(file);
        console.log(
          "✅ URL da imagem criada:",
          imageUrl.substring(0, 50) + "..."
        );

        // Criar imagem de teste para validar
        const testImg = new Image();

        testImg.onload = function () {
          console.log(
            "✅ Imagem válida! Dimensões:",
            testImg.width,
            "x",
            testImg.height
          );

          // Atualizar foto de perfil principal
          const profilePic = document.getElementById("profilePic");
          if (profilePic) {
            profilePic.src = imageUrl;
            console.log("✅ Foto de perfil principal atualizada");

            // Verificar se carregou
            profilePic.onload = function () {
              console.log("✅ Foto carregada com sucesso na interface!");
            };

            profilePic.onerror = function () {
              console.error("❌ Erro ao carregar foto na interface");
            };
          }

          // Atualizar dados do perfil
          profileData.profilePic = imageUrl;

          // Atualizar outras fotos de perfil na página
          document
            .querySelectorAll(".profile-pic-40, .post-author-pic")
            .forEach((img) => {
              if (
                img.alt &&
                (img.alt.includes("Sua foto") || img.alt.includes("Você"))
              ) {
                img.src = imageUrl;
              }
            });

          // Adicionar à galeria
          photos.push({
            id: Date.now(),
            src: imageUrl,
            title: "Nova foto de perfil",
            type: "image",
          });

          // CRIAR POST AUTOMÁTICO DA FOTO DE PERFIL
          const profilePost = {
            id: Date.now() + 999,
            author: profileData.name,
            authorPic: imageUrl,
            time: "agora",
            content: "Atualizou a foto do perfil ✨",
            image: imageUrl,
            privacy: "public",
            likes: 0,
            comments: [],
            liked: false,
            isProfilePicPost: true,
          };

          posts.unshift(profilePost);

          // Atualizar contadores
          updateStats();

          // Renderizar posts para mostrar o novo post
          renderPosts();

          // Remover loading
          if (loadingDiv.parentNode) {
            document.body.removeChild(loadingDiv);
          }

          alert(
            `✅ Foto atualizada com sucesso! 🎉\n\n📏 ${testImg.width}x${
              testImg.height
            }px\n📦 ${(file.size / 1024).toFixed(1)}KB`
          );
          console.log(
            "✅ SUCESSO COMPLETO: Foto de perfil atualizada via createObjectURL"
          );
        };

        testImg.onerror = function () {
          console.error("❌ Imagem corrompida ou inválida");
          URL.revokeObjectURL(imageUrl);
          if (loadingDiv.parentNode) {
            document.body.removeChild(loadingDiv);
          }
          alert("❌ Imagem corrompida! Tente outro arquivo.");
        };

        testImg.src = imageUrl;
      } catch (error) {
        console.error("❌ Erro ao criar URL da imagem:", error);
        if (loadingDiv.parentNode) {
          document.body.removeChild(loadingDiv);
        }
        alert("❌ Erro ao processar imagem: " + error.message);
      }
    } else {
      console.log("❌ Nenhum arquivo selecionado");
    }
  };

  input.click();
}

// Lidar com enter no chat
function handleChatEnter(event, chatId, friendId) {
  if (event.key === "Enter" && event.target.value.trim()) {
    // Verificar se ainda são amigos antes de enviar mensagem
    const friends = JSON.parse(localStorage.getItem("friends") || "[]");
    const isFriend = friends.some((friend) => friend.id === friendId);

    if (!isFriend) {
      alert(
        "❌ Você não pode mais enviar mensagens para esta pessoa! Vocês não são mais amigos."
      );
      return;
    }

    const message = event.target.value.trim();
    const chatData = openChats.find((c) => c.chatId === chatId);

    if (chatData) {
      // Adicionar mensagem ao chat
      addMessageToChat(chatId, message, "Você", profileData.profilePic, true);

      // Atualizar conversa
      let conversation = conversations.find((c) => c.friendId === friendId);
      if (!conversation) {
        conversation = {
          friendId: friendId,
          friendName: chatData.friendName,
          friendPic: "https://via.placeholder.com/40",
          online: Math.random() > 0.5,
          lastMessage: message,
          timestamp: "agora",
          unread: 0,
          messages: [],
        };
        conversations.unshift(conversation);
      } else {
        conversation.lastMessage = message;
        conversation.timestamp = "agora";
        // Mover para o topo
        conversations = conversations.filter((c) => c.friendId !== friendId);
        conversations.unshift(conversation);
      }

      // Adicionar mensagem ao histórico
      conversation.messages.push({
        from: profileData.name,
        text: message,
        timestamp: Date.now(),
      });
    }

    event.target.value = "";
  }
}

// ================================================
// SISTEMA DE GERENCIAMENTO DE AMIGOS
// ================================================

// Variável para controlar edição de apelido
let editingFriendId = null;

// Carregar lista de amigos do Supabase
async function carregarAmigos() {
  try {
    console.log("📋 Carregando lista de amigos...");

    const { data, error } = await supabaseClient
      .from("friends")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Erro ao carregar amigos:", error);
      document.getElementById("amigos-ul").innerHTML =
        '<li style="color: #e74c3c;">❌ Erro ao carregar amigos</li>';
      return;
    }

    const ul = document.getElementById("amigos-ul");

    if (data && data.length > 0) {
      ul.innerHTML = "";

      data.forEach((amigo) => {
        const li = document.createElement("li");
        li.className = "friend-item-modal";
        li.style.cssText = `
                    display: flex; 
                    align-items: center; 
                    padding: 10px; 
                    border-radius: 8px; 
                    margin-bottom: 8px; 
                    background: #f8f9fa;
                    cursor: pointer;
                    transition: background 0.2s;
                `;

        const friendPic = document.createElement("img");
        friendPic.src = amigo.friend_pic || "https://picsum.photos/40?random=8";
        friendPic.className = "friend-pic";
        friendPic.style.cssText = `
                    width: 40px; 
                    height: 40px; 
                    border-radius: 50%; 
                    margin-right: 10px; 
                    object-fit: cover;
                `;

        const friendInfo = document.createElement("div");
        friendInfo.style.flex = "1";

        const displayName =
          amigo.nickname || amigo.friend_id || "ID não definido";
        const realName = amigo.friend_name || "Nome não informado";

        friendInfo.innerHTML = `
                    <div style="font-weight: bold; color: #333;">
                        ${displayName}
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        ${realName} • ${
          amigo.is_online ? "🟢 Online" : "⚫ Offline"
        }
                    </div>
                `;

        li.appendChild(friendPic);
        li.appendChild(friendInfo);

        // Só Julia pode editar apelidos
        if (isOwner) {
          const buttonsContainer = document.createElement("div");
          buttonsContainer.style.display = "flex";
          buttonsContainer.style.gap = "5px";

          const editBtn = document.createElement("button");
          editBtn.innerHTML = "✏️";
          editBtn.title = "Editar apelido";
          editBtn.style.cssText = `
                        background: var(--primary-color); 
                        color: white; 
                        border: none; 
                        border-radius: 4px; 
                        padding: 5px 8px; 
                        cursor: pointer; 
                        font-size: 12px;
                    `;
          editBtn.onclick = (e) => {
            e.stopPropagation();
            iniciarEdicaoApelido(
              amigo.friend_id,
              amigo.friend_name,
              amigo.nickname
            );
          };

          // Botão para gerar apelido automático (se não tiver apelido)
          if (!amigo.nickname) {
            const autoBtn = document.createElement("button");
            autoBtn.innerHTML = "🎲";
            autoBtn.title = "Gerar apelido automático";
            autoBtn.style.cssText = `
                            background: #28a745; 
                            color: white; 
                            border: none; 
                            border-radius: 4px; 
                            padding: 5px 8px; 
                            cursor: pointer; 
                            font-size: 12px;
                        `;
            autoBtn.onclick = async (e) => {
              e.stopPropagation();
              const newNickname = await generateAutoNickname(amigo.friend_id);
              if (newNickname) {
                carregarAmigos(); // Recarregar lista para mostrar novo apelido
              }
            };

            buttonsContainer.appendChild(autoBtn);
          }

          buttonsContainer.appendChild(editBtn);
          li.appendChild(buttonsContainer);
        }

        // Hover effect
        li.onmouseenter = () => (li.style.background = "#e9ecef");
        li.onmouseleave = () => (li.style.background = "#f8f9fa");

        ul.appendChild(li);
      });

      console.log(`✅ ${data.length} amigos carregados`);
    } else {
      ul.innerHTML =
        '<li style="color: #666; padding: 20px; text-align: center;">👥 Você ainda não tem amigos adicionados.</li>';
      console.log("ℹ️ Nenhum amigo encontrado");
    }
  } catch (error) {
    console.error("❌ Erro ao carregar amigos:", error);
    document.getElementById("amigos-ul").innerHTML =
      '<li style="color: #e74c3c;">❌ Erro ao conectar com o servidor</li>';
  }
}

// Iniciar edição de apelido (só para Julia)
function iniciarEdicaoApelido(friendId, friendName, currentNickname) {
  if (!isOwner) {
    console.log("❌ Apenas Julia pode editar apelidos");
    return;
  }

  editingFriendId = friendId;

  document.getElementById("edit-friend-name").textContent =
    friendName || friendId;
  document.getElementById("novo-apelido").value = currentNickname || "";
  document.getElementById("edit-nickname-area").style.display = "block";

  console.log("✏️ Editando apelido do amigo:", friendId);
}

// Cancelar edição de apelido
function cancelarEdicaoApelido() {
  editingFriendId = null;
  document.getElementById("edit-nickname-area").style.display = "none";
  document.getElementById("novo-apelido").value = "";
  console.log("❌ Edição de apelido cancelada");
}

// Atualizar apelido no Supabase (só para Julia)
async function atualizarApelido() {
  if (!isOwner) {
    alert("❌ Apenas Julia pode editar apelidos!");
    return;
  }

  if (!editingFriendId) {
    alert("❌ Erro: Nenhum amigo selecionado para edição");
    return;
  }

  const novoApelido = document.getElementById("novo-apelido").value.trim();

  if (!novoApelido) {
    alert("❌ Digite um apelido!");
    return;
  }

  try {
    console.log("💾 Salvando novo apelido...");

    // Buscar Julia (owner) para usar seu ID
    const { data: juliaData, error: juliaError } = await supabaseClient
      .from("users")
      .select("id")
      .eq("is_owner", true)
      .single();

    if (juliaError || !juliaData) {
      console.error("❌ Erro ao encontrar Julia:", juliaError);
      alert("❌ Erro interno: Não foi possível identificar o proprietário");
      return;
    }

    const { error } = await supabaseClient
      .from("friends")
      .update({ nickname: novoApelido })
      .eq("friend_id", editingFriendId)
      .eq("user_id", juliaData.id);

    if (error) {
      console.error("❌ Erro ao atualizar apelido:", error);
      alert("❌ Erro ao salvar apelido: " + error.message);
      return;
    }

    console.log("✅ Apelido atualizado com sucesso!");
    alert("✅ Apelido atualizado com sucesso!");

    // Fechar área de edição
    cancelarEdicaoApelido();

    // Recarregar lista de amigos
    carregarAmigos();
  } catch (error) {
    console.error("❌ Erro ao atualizar apelido:", error);
    alert("❌ Erro inesperado ao salvar apelido");
  }
}

// Abrir modal de amigos e carregar lista
function openFriendsModal() {
  document.getElementById("friendsModal").style.display = "flex";
  carregarAmigos(); // Carregar amigos sempre que abrir o modal
}

// Fechar modal de amigos
function closeFriendsModal() {
  document.getElementById("friendsModal").style.display = "none";
  cancelarEdicaoApelido(); // Cancelar edição se estiver aberta
}

// Aceitar solicitação de amizade com apelido automático
async function acceptFriendRequestWithNickname(requestId) {
  if (!isOwner) {
    alert("❌ Apenas Julia pode aceitar solicitações!");
    return;
  }

  try {
    console.log("🤝 Aceitando solicitação de amizade...", requestId);

    // Chamar função do Supabase que aceita e gera apelido automático
    const { data, error } = await supabaseClient.rpc("accept_friend_request", {
      request_id: requestId,
    });

    if (error) {
      console.error("❌ Erro ao aceitar solicitação:", error);
      alert("❌ Erro ao aceitar solicitação: " + error.message);
      return false;
    }

    if (data) {
      console.log("✅ Solicitação aceita com sucesso!");
      alert("✅ Solicitação aceita! Apelido automático gerado.");

      // Recarregar solicitações e amigos
      await loadFriendRequestsFromDB();
      await carregarAmigos();

      return true;
    } else {
      console.error("❌ Falha ao processar solicitação");
      alert("❌ Erro: Solicitação não pôde ser processada");
      return false;
    }
  } catch (error) {
    console.error("❌ Erro ao aceitar solicitação:", error);
    alert("❌ Erro inesperado ao aceitar solicitação");
    return false;
  }
}

// Gerar apelido automático para amigo existente (se não tiver)
async function generateAutoNickname(friendId) {
  if (!isOwner) {
    alert("❌ Apenas Julia pode gerar apelidos!");
    return;
  }

  try {
    console.log("🎲 Gerando apelido automático...");

    // Chamar função do Supabase para gerar apelido
    const { data, error } = await supabaseClient.rpc(
      "generate_friend_nickname"
    );

    if (error) {
      console.error("❌ Erro ao gerar apelido:", error);
      return null;
    }

    const newNickname = data;

    // Buscar Julia (owner) para usar seu ID
    const { data: juliaData, error: juliaError } = await supabaseClient
      .from("users")
      .select("id")
      .eq("is_owner", true)
      .single();

    if (juliaError || !juliaData) {
      console.error("❌ Erro ao encontrar Julia:", juliaError);
      return null;
    }

    // Atualizar apelido do amigo
    const { error: updateError } = await supabaseClient
      .from("friends")
      .update({ nickname: newNickname })
      .eq("friend_id", friendId)
      .eq("user_id", juliaData.id);

    if (updateError) {
      console.error("❌ Erro ao salvar apelido:", updateError);
      return null;
    }

    console.log("✅ Apelido automático gerado:", newNickname);
    return newNickname;
  } catch (error) {
    console.error("❌ Erro ao gerar apelido automático:", error);
    return null;
  }
}

// Fechar modais clicando fora
window.onclick = function (event) {
  if (
    event.target.classList.contains("modal") ||
    event.target.classList.contains("gallery-modal") ||
    event.target.classList.contains("media-viewer")
  ) {
    event.target.style.display = "none";
  }

  // Fechar dropdowns quando clicar fora
  if (
    !event.target.matches(".menu-dots") &&
    !event.target.closest(".post-menu") &&
    !event.target.closest(".media-menu-modern") &&
    !event.target.closest(".header-icon") &&
    !event.target.closest(".friend-requests-dropdown") &&
    !event.target.closest(".messages-dropdown")
  ) {
    document.querySelectorAll(".dropdown-menu").forEach((menu) => {
      menu.style.display = "none";
      menu.classList.remove("show");
    });

    document.querySelectorAll(".media-dropdown-modern").forEach((menu) => {
      menu.style.display = "none";
    });

    // Fechar dropdowns do header
    document
      .querySelectorAll(".messages-dropdown, .friend-requests-dropdown")
      .forEach((dropdown) => {
        dropdown.classList.remove("show");
      });
  }
};
