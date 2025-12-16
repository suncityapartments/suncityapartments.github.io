import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

declare const google: any;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private idToken: string | null = null; // ID token from Google Identity
  private accessToken: string | null = null; // OAuth2 token for Sheets API
  private userProfile: any = null;
  private tokenClient: any;

  private readonly tokenKey = 'accessToken';
  private readonly idTokenKey = 'idToken';
  private readonly profileKey = 'userProfile';

  constructor(private zone: NgZone, private router: Router) {
    // Restore state from localStorage on service init
    this.idToken = localStorage.getItem(this.idTokenKey);
    this.accessToken = localStorage.getItem(this.tokenKey);
    const profileRaw = localStorage.getItem(this.profileKey);

    if (profileRaw) {
      this.userProfile = JSON.parse(profileRaw);
    }
  }

  /**
   * Initializes Google Sign-In (ID token flow).
   */
  initGoogleSignIn(callback: () => void) {
    google.accounts.id.initialize({
      client_id: environment.googleClientID,
      callback: (response: any) => {
        this.zone.run(() => {
          this.idToken = response.credential;
          this.decodeToken();

          // Persist ID token & profile
          localStorage.setItem(this.idTokenKey, this.idToken!);
          localStorage.setItem(this.profileKey, JSON.stringify(this.userProfile));

          // After login, request Sheets access
          this.initTokenClient(callback);
        });
      },
    });
  }

  /**
   * Renders the Google Sign-In button.
   */
  renderButton(elementID: string) {
    google.accounts.id.renderButton(document.getElementById(elementID), {
      theme: 'outline',
      size: 'large',
    });
  }

  /**
   * Initializes OAuth2 token client for Google Sheets.
   */
  private initTokenClient(callback: () => void) {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: environment.googleClientID,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      hint: this.userProfile?.email, // 👈 prevents double account chooser
      callback: (tokenResponse: any) => {
        this.zone.run(() => {
          if (tokenResponse?.access_token) {
            this.accessToken = tokenResponse.access_token;
            if (this.accessToken) {
              localStorage.setItem(this.tokenKey, this.accessToken);
            }
          }
          callback();
        });
      },
    });

    // Only request a token if one is missing
    if (!this.accessToken) {
      this.tokenClient.requestAccessToken({ prompt: '' }); // prompt='' avoids extra chooser if already granted
    }
  }

  /**
   * Decode the ID token into user profile.
   */
  private decodeToken() {
    if (!this.idToken) return;
    const base64Url = this.idToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(window.atob(base64));
    this.userProfile = decoded;
  }

  getUserProfile() {
    return this.userProfile;
  }

  getAccessToken() {
    return this.accessToken;
  }

  isLoggedIn(): boolean {
    return !!this.accessToken;
  }

  signOut() {
    this.idToken = null;
    this.accessToken = null;
    this.userProfile = null;

    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.idTokenKey);
    localStorage.removeItem(this.profileKey);

    this.router.navigate(['/parking/login']);
  }

  /**
   * Fetch rows from Google Sheets for the given A1 range (e.g. "Tags!A1:F100").
   */
  async fetchSheetData(range: string): Promise<any[]> {
    await this.ensureAccessToken();

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${environment.sheetID}/values/${encodeURIComponent(
      range,
    )}`;

    let response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (response.status === 401 || response.status === 403) {
      await this.requestNewAccessToken();
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      });
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch sheet data (${response.status}): ${text}`);
    }

    const data = await response.json();

    return data.values || [];
  }

  /**
   * Ensure access token is available; refresh if necessary.
   */
  private async ensureAccessToken(): Promise<void> {
    if (this.accessToken) return;
    if (!this.tokenClient) throw new Error('Not authenticated. Please sign in first.');
    await this.requestNewAccessToken();
  }

  /**
   * Request a fresh access token.
   */
  private requestNewAccessToken(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.tokenClient.callback = (tokenResponse: any) => {
          this.zone.run(() => {
            if (tokenResponse?.access_token) {
              this.accessToken = tokenResponse.access_token;
              if (this.accessToken) {
                localStorage.setItem(this.tokenKey, this.accessToken);
              }
              resolve();
            } else {
              reject(new Error('Failed to obtain access token'));
            }
          });
        };

        this.tokenClient.requestAccessToken({ prompt: '' }); // prompt='' suppresses extra chooser
      } catch (err) {
        reject(err);
      }
    });
  }
}
