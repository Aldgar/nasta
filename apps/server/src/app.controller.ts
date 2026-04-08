import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from './auth/decorators/public.decorator';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('verify-email')
  @Public()
  verifyEmailRedirect(
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!token) {
      throw new BadRequestException('Missing token');
    }

    const deepLink = `nasta://verify-email?token=${encodeURIComponent(token)}`;

    // On mobile, avoid showing the intermediate HTML page.
    // This makes the email button feel like a proper deep-link.
    const ua = (req.headers['user-agent'] || '').toString();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    if (isMobile) {
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, deepLink);
    }

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Open Nasta</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 32px; }
      a { word-break: break-all; }
    </style>
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () {
          window.location.href = ${JSON.stringify(deepLink)};
        }, 100);
      });
    </script>
  </head>
  <body>
    <p>Opening the Nasta app…</p>
    <p>If it doesn’t open automatically, tap this link:</p>
    <p><a href="${deepLink}">${deepLink}</a></p>
    <noscript>
      <p>JavaScript is disabled. Tap the link above to open the app.</p>
    </noscript>
  </body>
</html>`;

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).type('html').send(html);
  }

  @Get('.well-known/apple-app-site-association')
  @Public()
  appleAppSiteAssociation(@Res() res: Response) {
    const teamId = this.config.get<string>('APPLE_TEAM_ID');
    const bundleId =
      this.config.get<string>('IOS_BUNDLE_ID') || 'com.mohamedibrahim.nasta';

    // Apple requires TEAMID.BUNDLEID
    const appId = teamId ? `${teamId}.${bundleId}` : null;

    const payload = {
      applinks: {
        apps: [],
        details: appId
          ? [
              {
                appID: appId,
                paths: ['/jobs/*', '/verify-email*'],
              },
            ]
          : [],
      },
    };

    // Must be served as application/json (no redirects)
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(payload);
  }

  @Get('.well-known/assetlinks.json')
  @Public()
  androidAssetLinks(@Res() res: Response) {
    const packageName =
      this.config.get<string>('ANDROID_PACKAGE_NAME') ||
      'com.mohamedibrahim.nasta';
    const fingerprint = this.config.get<string>(
      'ANDROID_SHA256_CERT_FINGERPRINT',
    );

    const payload = fingerprint
      ? [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: packageName,
              sha256_cert_fingerprints: [fingerprint],
            },
          },
        ]
      : [];

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(payload);
  }
}
