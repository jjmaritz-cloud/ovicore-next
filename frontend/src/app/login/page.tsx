"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import OviCoreBrandIcon from "@/components/OviCoreBrandIcon";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8001";

type LoginResponse = {
  message: string;
  must_change_password: boolean;
};

type ApiError = {
  detail?: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("jj@ovicore.com.au");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalisedEmail = email.trim().toLowerCase();

    if (!normalisedEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalisedEmail,
          password,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | LoginResponse
        | ApiError
        | null;

      if (!response.ok) {
        const apiError =
          data && "detail" in data && typeof data.detail === "string"
            ? data.detail
            : "Login failed. Please check your email address and password.";

        throw new Error(apiError);
      }

      if (rememberEmail) {
        window.localStorage.setItem(
          "ovicore_remembered_email",
          normalisedEmail
        );
      } else {
        window.localStorage.removeItem("ovicore_remembered_email");
      }

      const loginData = data as LoginResponse;

			if (loginData.must_change_password) {
				router.replace("/home");
				router.refresh();
				return;
			}

      router.replace("/home");
      router.refresh();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand-overlay" />

        <div className="brand-content">
          <div className="brand-mark">
            <OviCoreBrandIcon
							variant="white"
							size="small"
							className="login-brand-icon"
						/>

            <div>
              <div className="brand-name">OviCore</div>
              <div className="brand-tagline">
                Integrated poultry planning
              </div>
            </div>
          </div>

          <div className="brand-message">
            <span className="brand-eyebrow">POULTRY MANAGEMENT</span>

            <h1>
              Forecast with precision.
              <br />
              Deliver with confidence.
            </h1>

            <p>
              Secure access to your company&apos;s farms, flocks,
              production records and operational planning.
            </p>
          </div>

          <div className="brand-footer">
            OviCore poultry management software
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="mobile-brand">
            <OviCoreBrandIcon
							variant="orange"
							size="small"
							className="login-mobile-brand-icon"
						/>

            <div>
              <div className="brand-name dark">OviCore</div>
              <div className="brand-tagline dark">
                Integrated poultry planning
              </div>
            </div>
          </div>

          <div className="login-heading">
            <span className="secure-pill">Secure login</span>

            <h2>Welcome back</h2>

            <p>
              Sign in using your OviCore account.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="email">Email address</label>

              <input
                id="email"
                type="email"
                value={email}
                autoComplete="email"
                placeholder="name@company.com.au"
                disabled={loading}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrorMessage("");
                }}
              />
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>

              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  disabled={loading}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setErrorMessage("");
                  }}
                />

                <button
                  type="button"
                  className="password-toggle"
                  disabled={loading}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  disabled={loading}
                  onChange={(event) =>
                    setRememberEmail(event.target.checked)
                  }
                />

                <span>Remember email</span>
              </label>

              <button
                type="button"
                className="forgot-button"
                disabled={loading}
                onClick={() => {
                  alert(
                    "Password recovery will be added in the next security step."
                  );
                }}
              >
                Forgot password?
              </button>
            </div>

            {errorMessage ? (
              <div className="error-message" role="alert">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Signing in...
                </>
              ) : (
                "Sign in to OviCore"
              )}
            </button>
          </form>

          <div className="login-support">
            <strong>Need access?</strong>
            <span>
              Contact your Company Admin or OviCore administrator.
            </span>
          </div>
        </div>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .login-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(420px, 1.05fr) minmax(440px, 0.95fr);
          background: #f5f8f6;
          color: #143429;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .login-brand-panel {
          position: relative;
          overflow: hidden;
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 20% 20%,
              rgba(123, 194, 151, 0.22),
              transparent 30%
            ),
            radial-gradient(
              circle at 80% 82%,
              rgba(24, 117, 76, 0.34),
              transparent 36%
            ),
            linear-gradient(
              145deg,
              #082e24 0%,
              #0c4737 48%,
              #106044 100%
            );
        }

        .brand-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(
              rgba(255, 255, 255, 0.025) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.025) 1px,
              transparent 1px
            );
          background-size: 46px 46px;
          mask-image: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.9),
            transparent
          );
        }

        .brand-content {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          padding: 42px 52px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .brand-mark,
        .mobile-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

				.login-brand-icon {
					flex: 0 0 auto;
					box-shadow:
						0 9px 25px rgba(0, 0, 0, 0.18),
						inset 0 1px 0 rgba(255, 255, 255, 0.7);
				}

				.login-mobile-brand-icon {
					flex: 0 0 auto;
					box-shadow:
						0 8px 20px rgba(15, 23, 42, 0.14),
						inset 0 1px 0 rgba(255, 255, 255, 0.28);
				}

        .brand-name {
          color: #ffffff;
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .brand-name.dark {
          color: #0a4a36;
        }

        .brand-tagline {
          margin-top: 2px;
          color: rgba(235, 255, 244, 0.73);
          font-size: 11px;
          font-weight: 650;
        }

        .brand-tagline.dark {
          color: #688078;
        }

        .brand-message {
          max-width: 650px;
        }

        .brand-eyebrow {
          display: inline-flex;
          padding: 7px 11px;
          border: 1px solid rgba(190, 239, 209, 0.24);
          border-radius: 999px;
          background: rgba(220, 255, 232, 0.08);
          color: #c8f5d9;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.11em;
        }

        .brand-message h1 {
          margin: 22px 0 18px;
          color: #ffffff;
          font-size: clamp(42px, 5vw, 68px);
          line-height: 1.04;
          letter-spacing: -0.045em;
        }

        .brand-message p {
          max-width: 590px;
          margin: 0;
          color: rgba(236, 255, 244, 0.78);
          font-size: 17px;
          line-height: 1.65;
        }

        .brand-footer {
          color: rgba(233, 255, 242, 0.54);
          font-size: 12px;
          font-weight: 650;
        }

        .login-form-panel {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 36px;
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(12, 105, 70, 0.08),
              transparent 33%
            ),
            #f7faf8;
        }

        .login-card {
          width: min(100%, 460px);
          padding: 34px;
          border: 1px solid #dce8e1;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow:
            0 28px 70px rgba(16, 65, 47, 0.12),
            0 4px 12px rgba(16, 65, 47, 0.05);
          backdrop-filter: blur(14px);
        }

        .mobile-brand {
          display: none;
          margin-bottom: 30px;
        }

        .secure-pill {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          background: #e8f7ed;
          color: #147044;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .login-heading h2 {
          margin: 16px 0 5px;
          color: #123c2e;
          font-size: 34px;
          line-height: 1.1;
          letter-spacing: -0.035em;
        }

        .login-heading p {
          margin: 0 0 28px;
          color: #6d8179;
          font-size: 14px;
        }

        .field-group {
          margin-bottom: 18px;
        }

        .field-group label {
          display: block;
          margin-bottom: 7px;
          color: #294a3e;
          font-size: 12px;
          font-weight: 800;
        }

        .field-group input {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border: 1px solid #cfded6;
          border-radius: 10px;
          outline: none;
          background: #fbfdfc;
          color: #173f31;
          font-size: 14px;
          transition:
            border-color 120ms ease,
            box-shadow 120ms ease,
            background 120ms ease;
        }

        .field-group input:focus {
          border-color: #148452;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(20, 132, 82, 0.1);
        }

        .field-group input:disabled {
          cursor: not-allowed;
          opacity: 0.72;
        }

        .password-field {
          position: relative;
        }

        .password-field input {
          padding-right: 72px;
        }

        .password-toggle {
          position: absolute;
          top: 50%;
          right: 9px;
          transform: translateY(-50%);
          border: 0;
          border-radius: 7px;
          padding: 7px 9px;
          background: transparent;
          color: #267653;
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
        }

        .password-toggle:hover {
          background: #edf7f1;
        }

        .login-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin: 3px 0 18px;
        }

        .remember-option {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #526b61;
          font-size: 12px;
          cursor: pointer;
        }

        .remember-option input {
          width: 15px;
          height: 15px;
          accent-color: #0b7650;
        }

        .forgot-button {
          border: 0;
          padding: 0;
          background: transparent;
          color: #177049;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .forgot-button:hover {
          text-decoration: underline;
        }

        .error-message {
          margin-bottom: 14px;
          padding: 11px 12px;
          border: 1px solid #f2c6c3;
          border-radius: 9px;
          background: #fff0ef;
          color: #9c322c;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.4;
        }

        .login-button {
          width: 100%;
          height: 50px;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          gap: 9px;
          border: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, #07563d, #0d7a50);
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 13px 24px rgba(9, 105, 69, 0.18);
          transition:
            transform 120ms ease,
            box-shadow 120ms ease,
            opacity 120ms ease;
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 15px 28px rgba(9, 105, 69, 0.24);
        }

        .login-button:disabled {
          cursor: wait;
          opacity: 0.72;
        }

        .spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255, 255, 255, 0.45);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 700ms linear infinite;
        }

        .login-support {
          margin-top: 22px;
          padding-top: 20px;
          border-top: 1px solid #e7eeea;
          display: flex;
          flex-direction: column;
          gap: 3px;
          color: #6b8077;
          font-size: 11px;
          text-align: center;
        }

        .login-support strong {
          color: #35584a;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .login-page {
            grid-template-columns: 1fr;
          }

          .login-brand-panel {
            display: none;
          }

          .login-form-panel {
            padding: 22px;
          }

          .mobile-brand {
            display: flex;
          }
        }

        @media (max-width: 520px) {
          .login-form-panel {
            padding: 0;
            align-items: stretch;
          }

          .login-card {
            width: 100%;
            min-height: 100vh;
            padding: 28px 22px;
            border: 0;
            border-radius: 0;
            box-shadow: none;
          }

          .login-heading h2 {
            font-size: 30px;
          }

          .login-options {
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}