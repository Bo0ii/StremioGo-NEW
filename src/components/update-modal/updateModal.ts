import { marked } from "marked";
import TemplateCache from "../../utils/templateCache";
import Updater from "../../core/Updater";
import { IPC_CHANNELS } from "../../constants";
import { ipcRenderer } from "electron";

type UpdateState = 'idle' | 'downloading' | 'installing' | 'completed' | 'error';

let updateState: UpdateState = 'idle';
let installerPath: string | null = null;

export async function getUpdateModalTemplate(): Promise<string> {
    let template = TemplateCache.load(__dirname, 'update-modal');
    
    const releaseNotes = await Updater.getReleaseNotes();
    const markdown = await marked(releaseNotes, { gfm: true, breaks: true });

    const currentVersion = Updater.getCurrentVersion();
    const latestVersion = await Updater.getLatestVersion();

    const html = template
        .replace("{{ releaseNotes }}", markdown)
        .replace(/\{\{\s*currentVersion\s*\}\}/g, currentVersion)
        .replace(/\{\{\s*newVersion\s*\}\}/g, latestVersion);

    // Initialize event handlers after a short delay to ensure DOM is ready
    setTimeout(() => {
        initializeUpdateModal();
    }, 100);

    return html;
}

function initializeUpdateModal(): void {
    const modalContainer = document.getElementById('updateModalContainer');
    if (!modalContainer) return;

    const installButton = document.getElementById('updateInstallButton');
    const ignoreButton = document.getElementById('updateIgnoreButton');
    const closeButton = document.getElementById('updateModalCloseButton');
    const progressContainer = document.getElementById('updateProgressContainer');
    const progressBar = document.getElementById('updateProgressBar');
    const statusText = document.getElementById('updateStatusText');
    const detailsText = document.getElementById('updateDetailsText');

    if (!installButton || !ignoreButton || !progressContainer || !progressBar || !statusText || !detailsText) {
        console.error('Update modal elements not found');
        return;
    }

    // Setup Install button click handler
    installButton.addEventListener('click', async () => {
        if (updateState === 'idle') {
            await startDownload();
        } else if (updateState === 'completed') {
            // After download is complete, start installation
            await startInstallation();
        }
    });

    // Setup Ignore button - only allow closing if not downloading/installing
    ignoreButton.addEventListener('click', () => {
        if (updateState !== 'downloading' && updateState !== 'installing') {
            cleanupAndClose();
        }
    });

    // Setup Close button - only allow closing if not downloading/installing
    if (closeButton) {
        closeButton.onclick = () => {
            if (updateState !== 'downloading' && updateState !== 'installing') {
                cleanupAndClose();
            }
        };
    }

    // Setup IPC listeners for progress updates
    ipcRenderer.on(IPC_CHANNELS.UPDATE_DOWNLOAD_PROGRESS, (_: any, data: { progress: number; bytesDownloaded: number; totalBytes: number }) => {
        updateDownloadProgress(data.progress, data.bytesDownloaded, data.totalBytes);
    });

    ipcRenderer.on(IPC_CHANNELS.UPDATE_DOWNLOAD_COMPLETE, (_: any, data: { installerPath: string }) => {
        installerPath = data.installerPath;
        onDownloadComplete();
    });

    ipcRenderer.on(IPC_CHANNELS.UPDATE_INSTALL_START, () => {
        onInstallStart();
    });

    ipcRenderer.on(IPC_CHANNELS.UPDATE_INSTALL_COMPLETE, () => {
        onInstallComplete();
    });

    ipcRenderer.on(IPC_CHANNELS.UPDATE_ERROR, (_: any, error: { stage: string; message: string }) => {
        onUpdateError(error.stage, error.message);
    });
}

async function startDownload(): Promise<void> {
    updateState = 'downloading';

    const installButton = document.getElementById('updateInstallButton');
    const ignoreButton = document.getElementById('updateIgnoreButton');
    const progressContainer = document.getElementById('updateProgressContainer');
    const statusText = document.getElementById('updateStatusText');
    const detailsText = document.getElementById('updateDetailsText');

    if (!installButton || !ignoreButton || !progressContainer || !statusText || !detailsText) return;

    // Update UI for downloading state
    progressContainer.style.display = 'block';
    statusText.textContent = 'Downloading update...';
    detailsText.textContent = 'Preparing download...';
    (installButton as HTMLElement).style.opacity = '0.6';
    (installButton as HTMLElement).style.pointerEvents = 'none';
    (ignoreButton as HTMLElement).style.opacity = '0.6';
    (ignoreButton as HTMLElement).style.pointerEvents = 'none';

    try {
        const result = await ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD_START);
        if (!result.success) {
            throw new Error(result.error || 'Download failed');
        }
    } catch (error) {
        onUpdateError('download', (error as Error).message);
    }
}

async function startInstallation(): Promise<void> {
    if (!installerPath) {
        onUpdateError('install', 'Installer path not found. Please try downloading again.');
        return;
    }

    updateState = 'installing';

    const installButton = document.getElementById('updateInstallButton');
    const ignoreButton = document.getElementById('updateIgnoreButton');
    const statusText = document.getElementById('updateStatusText');
    const detailsText = document.getElementById('updateDetailsText');

    if (!installButton || !ignoreButton || !statusText || !detailsText) return;

    // Update UI for installing state
    (installButton as HTMLElement).style.opacity = '0.6';
    (installButton as HTMLElement).style.pointerEvents = 'none';
    (ignoreButton as HTMLElement).style.opacity = '0.6';
    (ignoreButton as HTMLElement).style.pointerEvents = 'none';

    // All platforms now have automatic installation
    statusText.textContent = 'Installing update...';
    detailsText.textContent = 'The app will close and reopen automatically with the new version. Please wait...';

    try {
        const result = await ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL_START, installerPath);
        if (!result.success) {
            throw new Error(result.error || 'Installation failed');
        }
        // Note: For all platforms, the app will quit before we get here
    } catch (error) {
        onUpdateError('install', (error as Error).message);
    }
}

function updateDownloadProgress(progress: number, bytesDownloaded: number, totalBytes: number): void {
    // Use requestAnimationFrame to ensure UI updates happen during repaint cycle
    // This is especially important on Windows where the UI thread needs explicit repaint events
    requestAnimationFrame(() => {
        const progressBar = document.getElementById('updateProgressBar');
        const statusText = document.getElementById('updateStatusText');
        const detailsText = document.getElementById('updateDetailsText');

        if (!progressBar || !statusText || !detailsText) return;

        // Reset any error styling
        detailsText.style.color = '';
        progressBar.style.background = 'linear-gradient(90deg, #4a90e2, #357abd)';

        progressBar.style.width = `${Math.min(progress, 100)}%`;
        statusText.textContent = `Downloading update... ${Math.round(progress)}%`;

        // Format bytes
        const downloadedMB = (bytesDownloaded / (1024 * 1024)).toFixed(2);
        const totalMB = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(2) : '?';
        detailsText.textContent = `Downloaded ${downloadedMB} MB of ${totalMB} MB`;
        
        // Force a repaint on Windows by accessing offsetHeight (triggers layout recalculation)
        // This ensures the progress bar visual update is immediately visible
        if (process.platform === 'win32') {
            void progressBar.offsetHeight;
        }
    });
}

function onDownloadComplete(): void {
    updateState = 'completed';

    const installButton = document.getElementById('updateInstallButton');
    const ignoreButton = document.getElementById('updateIgnoreButton');
    const statusText = document.getElementById('updateStatusText');
    const detailsText = document.getElementById('updateDetailsText');
    const progressBar = document.getElementById('updateProgressBar');

    if (!installButton || !ignoreButton || !statusText || !detailsText || !progressBar) return;

    progressBar.style.width = '100%';

    // All platforms now have automatic installation and restart
    statusText.textContent = 'Download complete! Ready to install.';
    detailsText.textContent = 'Click Install to automatically apply the update. The app will close and reopen with the new version.';

    // Update button to show "Install"
    const buttonLabel = installButton.querySelector('.label-wbfsE');
    if (buttonLabel) {
        buttonLabel.textContent = 'Install';
    }
    installButton.setAttribute('title', 'Install Update');
    (installButton as HTMLElement).style.opacity = '1';
    (installButton as HTMLElement).style.pointerEvents = 'auto';

    // Re-enable ignore button
    (ignoreButton as HTMLElement).style.opacity = '1';
    (ignoreButton as HTMLElement).style.pointerEvents = 'auto';

    // For macOS, auto-install after download (to show progress immediately)
    const platform = process.platform;
    if (platform === 'darwin' && installerPath) {
        setTimeout(() => {
            ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL_START, installerPath).catch((error: Error) => {
                onUpdateError('install', error.message);
            });
        }, 500);
    }
}

function onInstallStart(): void {
    const statusText = document.getElementById('updateStatusText');
    const detailsText = document.getElementById('updateDetailsText');

    if (!statusText || !detailsText) return;

    // This is only reached on macOS (Windows/Linux quit before this event)
    statusText.textContent = 'Installing update...';
    detailsText.textContent = 'Please wait while the update is installed...';
}

function onInstallComplete(): void {
    // This is only reached on macOS (Windows/Linux quit before this event)
    updateState = 'completed';

    const installButton = document.getElementById('updateInstallButton');
    const ignoreButton = document.getElementById('updateIgnoreButton');
    const statusText = document.getElementById('updateStatusText');
    const detailsText = document.getElementById('updateDetailsText');
    const progressBar = document.getElementById('updateProgressBar');

    if (!installButton || !ignoreButton || !statusText || !detailsText || !progressBar) return;

    // Update UI for completed state
    progressBar.style.width = '100%';
    statusText.textContent = 'Installation complete!';
    detailsText.textContent = 'Click Restart to apply the update.';

    // Update button to "Restart"
    const buttonLabel = installButton.querySelector('.label-wbfsE');
    if (buttonLabel) {
        buttonLabel.textContent = 'Restart';
    }
    installButton.setAttribute('title', 'Restart');
    (installButton as HTMLElement).style.opacity = '1';
    (installButton as HTMLElement).style.pointerEvents = 'auto';

    // Re-enable ignore button but hide it since we want to encourage restart
    (ignoreButton as HTMLElement).style.opacity = '0.5';
}

function onUpdateError(stage: string, message: string): void {
    updateState = 'error';

    const installButton = document.getElementById('updateInstallButton');
    const ignoreButton = document.getElementById('updateIgnoreButton');
    const statusText = document.getElementById('updateStatusText');
    const detailsText = document.getElementById('updateDetailsText');
    const progressBar = document.getElementById('updateProgressBar');

    if (!installButton || !ignoreButton || !statusText || !detailsText || !progressBar) return;

    statusText.textContent = `Error during ${stage}`;

    // Add helpful context to error messages
    let displayMessage = message;
    if (stage === 'download') {
        if (message.includes('corrupted') || message.includes('size')) {
            displayMessage += '\n\nThis usually happens due to network issues. Click "Retry Download" to try again. If it keeps failing, try downloading the update manually from the releases page.';
        } else if (message.includes('HTTP') || message.includes('Network')) {
            displayMessage += '\n\nPlease check your internet connection and try again.';
        }
    } else if (stage === 'install') {
        if (message.includes('integrity') || message.includes('NSIS')) {
            displayMessage = 'The installer file may be corrupted. Click "Retry" to download and install again.';
        }
    }

    // Show detailed error message with line breaks preserved
    detailsText.innerHTML = displayMessage.replace(/\n/g, '<br>');
    detailsText.style.color = '#ff6b6b';
    progressBar.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';

    // Re-enable buttons
    const buttonLabel = installButton.querySelector('.label-wbfsE');
    if (buttonLabel) {
        buttonLabel.textContent = 'Retry';
    }
    (installButton as HTMLElement).style.opacity = '1';
    (installButton as HTMLElement).style.pointerEvents = 'auto';
    (ignoreButton as HTMLElement).style.opacity = '1';
    (ignoreButton as HTMLElement).style.pointerEvents = 'auto';

    // Reset state to idle so retry will work
    updateState = 'idle';
    installerPath = null;
}

// Removed: restartApplication - not used in current flow
// For macOS, the app automatically restarts after installation
// For Windows/Linux, the app quits and installer/script handles the restart

function cleanupAndClose(): void {
    // Remove IPC listeners to prevent memory leaks
    ipcRenderer.removeAllListeners(IPC_CHANNELS.UPDATE_DOWNLOAD_PROGRESS);
    ipcRenderer.removeAllListeners(IPC_CHANNELS.UPDATE_DOWNLOAD_COMPLETE);
    ipcRenderer.removeAllListeners(IPC_CHANNELS.UPDATE_INSTALL_START);
    ipcRenderer.removeAllListeners(IPC_CHANNELS.UPDATE_INSTALL_COMPLETE);
    ipcRenderer.removeAllListeners(IPC_CHANNELS.UPDATE_ERROR);

    const modalContainer = document.getElementById('updateModalContainer');
    if (modalContainer) {
        modalContainer.remove();
    }

    // Reset state
    updateState = 'idle';
    installerPath = null;
}
