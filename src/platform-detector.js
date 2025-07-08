const os = require('os');

/**
 * プラットフォーム検出ユーティリティ
 */
class PlatformDetector {
    static detect() {
        const platform = os.platform();
        const arch = os.arch();
        const release = os.release();
        
        return {
            platform,
            arch,
            release,
            isWindows: platform === 'win32',
            isMacOS: platform === 'darwin',
            isLinux: platform === 'linux',
            isUnix: platform !== 'win32',
            
            // 具体的なOS情報
            windowsVersion: platform === 'win32' ? this.getWindowsVersion(release) : null,
            macOSVersion: platform === 'darwin' ? this.getMacOSVersion(release) : null,
            linuxDistro: platform === 'linux' ? this.getLinuxDistro() : null,
            
            // mkcert関連の情報
            packageManager: this.getPackageManager(platform),
            installCommand: this.getInstallCommand(platform)
        };
    }
    
    static getWindowsVersion(release) {
        const version = parseFloat(release);
        if (version >= 10.0) return 'Windows 10/11';
        if (version >= 6.3) return 'Windows 8.1';
        if (version >= 6.2) return 'Windows 8';
        if (version >= 6.1) return 'Windows 7';
        return `Windows ${release}`;
    }
    
    static getMacOSVersion(release) {
        const version = parseInt(release.split('.')[0]);
        const versionMap = {
            23: 'Sonoma (14.x)',
            22: 'Ventura (13.x)',
            21: 'Monterey (12.x)',
            20: 'Big Sur (11.x)',
            19: 'Catalina (10.15)',
            18: 'Mojave (10.14)',
            17: 'High Sierra (10.13)'
        };
        return versionMap[version] || `macOS ${release}`;
    }
    
    static getLinuxDistro() {
        try {
            const fs = require('fs');
            if (fs.existsSync('/etc/os-release')) {
                const content = fs.readFileSync('/etc/os-release', 'utf8');
                const nameMatch = content.match(/^NAME="?([^"\\n]+)"?/m);
                const versionMatch = content.match(/^VERSION="?([^"\\n]+)"?/m);
                return nameMatch ? `${nameMatch[1]} ${versionMatch ? versionMatch[1] : ''}`.trim() : 'Unknown Linux';
            }
            return 'Unknown Linux';
        } catch {
            return 'Unknown Linux';
        }
    }
    
    static getPackageManager(platform) {
        switch (platform) {
            case 'win32':
                return 'choco'; // Chocolatey
            case 'darwin':
                return 'brew'; // Homebrew
            case 'linux':
                // 複数の可能性があるため、実際に存在するものを確認
                try {
                    const { execSync } = require('child_process');
                    const managers = ['apt', 'yum', 'dnf', 'pacman', 'zypper', 'apk'];
                    for (const manager of managers) {
                        try {
                            execSync(`which ${manager}`, { stdio: 'ignore' });
                            return manager;
                        } catch {
                            continue;
                        }
                    }
                    return 'manual'; // 手動インストール必要
                } catch {
                    return 'manual';
                }
            default:
                return 'manual';
        }
    }
    
    static getInstallCommand(platform) {
        const packageManager = this.getPackageManager(platform);
        
        const commands = {
            choco: 'choco install mkcert',
            brew: 'brew install mkcert',
            apt: 'sudo apt install libnss3-tools && curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64" && chmod +x mkcert-v*-linux-amd64 && sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert',
            yum: 'sudo yum install nss-tools && curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64" && chmod +x mkcert-v*-linux-amd64 && sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert',
            dnf: 'sudo dnf install nss-tools && curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64" && chmod +x mkcert-v*-linux-amd64 && sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert',
            pacman: 'sudo pacman -S mkcert',
            zypper: 'sudo zypper install mkcert',
            apk: 'apk add mkcert',
            manual: 'See https://github.com/FiloSottile/mkcert#installation'
        };
        
        return commands[packageManager] || commands.manual;
    }
    
    /**
     * システムの互換性をチェック
     */
    static checkCompatibility() {
        const info = this.detect();
        const issues = [];
        
        // Node.jsバージョンチェック
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        if (majorVersion < 16) {
            issues.push(`Node.js 16+ が必要です (現在: ${nodeVersion})`);
        }
        
        // プラットフォーム固有のチェック
        if (info.isWindows) {
            // Windows固有のチェック
            if (!process.env.CHOCOLATEY_INSTALL_PATH && !this.commandExists('choco')) {
                issues.push('Chocolateyがインストールされていません（推奨）');
            }
        } else if (info.isMacOS) {
            // macOS固有のチェック
            if (!this.commandExists('brew')) {
                issues.push('Homebrewがインストールされていません（推奨）');
            }
        } else if (info.isLinux) {
            // Linux固有のチェック
            if (!this.commandExists('openssl')) {
                issues.push('OpenSSLがインストールされていません');
            }
        }
        
        return {
            compatible: issues.length === 0,
            issues,
            recommendations: this.getRecommendations(info)
        };
    }
    
    static commandExists(command) {
        try {
            const { execSync } = require('child_process');
            const cmd = process.platform === 'win32' ? 'where' : 'which';
            execSync(`${cmd} ${command}`, { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }
    
    static getRecommendations(info) {
        const recommendations = [];
        
        if (info.isWindows) {
            recommendations.push('PowerShell 5.1+ または PowerShell 7+ を使用してください');
            recommendations.push('管理者権限でコマンドを実行することを推奨します');
        } else {
            recommendations.push('sudo権限が必要な場合があります');
        }
        
        recommendations.push('定期的な証明書更新のためにcronまたはタスクスケジューラーの設定を推奨します');
        
        return recommendations;
    }
}

module.exports = PlatformDetector;