const SUPABASE_URL = "https://zsmilczlumqkdpthlpto.supabase.co";
const SUPABASE_KEY = "sb_publishable__Oq50W1WSRfYcae0StNicg_FrzPwRTB";

const supabaseClient = window.supabase && window.supabase.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;


// =========================
// REGISTER
// =========================

const registerForm = document.getElementById("registerForm");

if (!supabaseClient && registerForm) {
  const message = document.getElementById("message");
  if (message) message.textContent = "Supabase is not available. Please load the Supabase client before auth.js.";
}

if (registerForm && supabaseClient) {

  registerForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;

    const message = document.getElementById("message");

    message.textContent = "Creating account...";

    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: fullName,
          role: role
        }
      }
    });

    if (error) {
      message.textContent = error.message;
      return;
    }

    // Create profile
    if (data.user) {

      const { error: profileError } = await supabaseClient
        .from("profiles")
        .insert({
          id: data.user.id,
          full_name: fullName,
          role: role
        });

      if (profileError) {
        console.error(profileError);
      }
    }

    message.textContent =
      "Registration successful. Check your email if email confirmation is enabled.";

  });
}


// =========================
// SIGN IN
// =========================

const signinForm = document.getElementById("signinForm");

if (signinForm && supabaseClient) {

  signinForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const email = document.getElementById("signinEmail").value.trim();
    const password = document.getElementById("signinPassword").value;

    const message = document.getElementById("signinMessage");

    message.textContent = "Signing in...";

    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

    if (error) {
      message.textContent = error.message;
      return;
    }

    message.textContent = "Sign in successful.";

    // Go to your main dashboard
    window.location.href = "index.html";

  });
}