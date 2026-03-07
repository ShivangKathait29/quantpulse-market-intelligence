// SECURITY FIX REQUIRED — ML: Potential cross-site scripting
// CWE: None
// Description: ML classifier detected potential cross-site scripting (confidence: 0.91).
// TODO: Apply a proper fix for this vulnerability.
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Footer Text -->
                            <p class="mobile-text dark-text-muted" style="margin: 40px 0 0 0; font-size: 14px; line-height: 1.5; color: #CCDADC !important; text-align: center;">
                               Signalist HQ, 200 Market Street, San Francisco, CA 94105<br>
                                <a href="#" style="color: #CCDADC !important; text-decoration: underline;">Unsubscribe</a> | 
                                <a href="https://stock-market-dev.vercel.app/" style="color: #CCDADC !important; text-decoration: underline;">Visit Signalist</a><br>
                                © 2025 Signalist
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

export const NEWS_SUMMARY_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="format-detection" content="telephone=no">
    <meta name="x-apple-disable-message-reformatting">
    <title>Market News Summary Today</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG/>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style type="text/css">
        /* Dark mode styles */
        @media (prefers-color-scheme: dark) {
            .email-container {
                background-color: #141414 !important;
                border: 1px solid #30333A !important;
            }
            .dark-bg {
                background-color: #050505 !important;
            }
            .dark-text {
                color: #ffffff !important;
            }
            .dark-text-secondary {
                color: #9ca3af !important;
            }
            .dark-text-muted {
                color: #6b7280 !important;
            }
            .dark-border {
                border-color: #30333A !important;
            }
            .dark-cta {
                background-color: #1f2937 !important;
                border: 1px solid #374151 !important;
            }
        }
        
        @media only screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
                margin: 0 !important;
            }
            .mobile-padding {
                padding: 24px !important;
            }
            .mobile-header-padding {
                padding: 24px 24px 12px 24px !important;
            }
            .mobile-text {
                font-size: 14px !important;
                line-height: 1.5 !important;
            }
            .mobile-title {
                font-size: 24px !important;
                line-height: 1.3 !important;
            }
            .mobile-news-title {
                font-size: 16px !important;
                line-height: 1.3 !important;
            }
            .mobile-outer-padding {
                padding: 20px 10px !important;
            }
        }