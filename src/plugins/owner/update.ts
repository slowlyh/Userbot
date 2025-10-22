/**
 * Copyright © 2025 [ slowlyh ]
 * GitHub Auto Update Plugin
 * 
 * Features:
 * - Update single file from repository
 * - Update all files from repository
 * - Check for updates
 * - View update diff
 * - Backup before update
 * - Rollback to previous version
 */

import type { PluginModule } from '../../types.js'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const REPO_URL = 'https://github.com/slowlyh/Userbot'
const REPO_RAW_URL = 'https://raw.githubusercontent.com/slowlyh/Userbot/main'
const BACKUP_DIR = path.join(process.cwd(), 'backups')
const BASE_DIR = process.cwd()

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

// File/folder yang di-ignore saat update
const IGNORE_PATTERNS = [
  '.env',
  'node_modules',
  'session',
  'logs',
  'tmp',
  'backups',
  'config/bot-settings.json',
  '.git',
  'package-lock.json'
]

// Cek apakah path harus di-ignore
function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern))
}

// Backup file sebelum update
function backupFile(filePath: string): string | null {
  try {
    const fullPath = path.join(BASE_DIR, filePath)
    
    if (!fs.existsSync(fullPath)) {
      return null
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFileName = `${filePath.replace(/\//g, '_')}_${timestamp}`
    const backupPath = path.join(BACKUP_DIR, backupFileName)
    
    // Ensure backup directory exists
    const backupDirPath = path.dirname(backupPath)
    if (!fs.existsSync(backupDirPath)) {
      fs.mkdirSync(backupDirPath, { recursive: true })
    }
    
    fs.copyFileSync(fullPath, backupPath)
    console.log(`✅ Backup created: ${backupPath}`)
    
    return backupPath
  } catch (err: any) {
    console.error(`❌ Backup failed for ${filePath}:`, err.message)
    return null
  }
}

// Download file dari GitHub
async function downloadFile(filePath: string): Promise<string> {
  try {
    const url = `${REPO_RAW_URL}/${filePath}`
    console.log(`📥 Downloading: ${url}`)
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const content = await response.text()
    
    if (!content || content.includes('404: Not Found')) {
      throw new Error('File not found in repository')
    }
    
    return content
  } catch (err: any) {
    throw new Error(`Download failed: ${err.message}`)
  }
}

// Update single file
async function updateFile(filePath: string): Promise<{ success: boolean; backup?: string; error?: string }> {
  try {
    // Validate path
    if (shouldIgnore(filePath)) {
      return { success: false, error: 'File is in ignore list' }
    }
    
    const fullPath = path.join(BASE_DIR, filePath)
    
    // Backup existing file
    let backupPath: string | null = null
    if (fs.existsSync(fullPath)) {
      backupPath = backupFile(filePath)
    }
    
    // Download new content
    const content = await downloadFile(filePath)
    
    // Ensure directory exists
    const dirPath = path.dirname(fullPath)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    
    // Write file
    fs.writeFileSync(fullPath, content, 'utf8')
    console.log(`✅ Updated: ${filePath}`)
    
    return { 
      success: true, 
      backup: backupPath || undefined 
    }
  } catch (err: any) {
    return { 
      success: false, 
      error: err.message 
    }
  }
}

// Get file list from GitHub repo
async function getRepoFileList(): Promise<string[]> {
  try {
    // Use GitHub API to get repository tree
    const apiUrl = `https://api.github.com/repos/slowlyh/Userbot/git/trees/main?recursive=1`
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Userbot-Updater'
      }
    })
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }
    
    const data: any = await response.json()
    
    if (!data.tree || !Array.isArray(data.tree)) {
      throw new Error('Invalid response from GitHub API')
    }
    
    // Filter only files (not directories)
    const files = data.tree
      .filter((item: any) => item.type === 'blob' && !shouldIgnore(item.path))
      .map((item: any) => item.path)
    
    return files
  } catch (err: any) {
    throw new Error(`Failed to get file list: ${err.message}`)
  }
}

// Update all files from repository
async function updateAllFiles(onProgress?: (current: number, total: number, file: string) => void): Promise<{
  success: number
  failed: number
  errors: { file: string; error: string }[]
}> {
  const result = {
    success: 0,
    failed: 0,
    errors: [] as { file: string; error: string }[]
  }
  
  try {
    const files = await getRepoFileList()
    console.log(`📋 Found ${files.length} files to update`)
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      if (onProgress) {
        onProgress(i + 1, files.length, file)
      }
      
      const updateResult = await updateFile(file)
      
      if (updateResult.success) {
        result.success++
      } else {
        result.failed++
        result.errors.push({ file, error: updateResult.error || 'Unknown error' })
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    return result
  } catch (err: any) {
    throw new Error(`Update all failed: ${err.message}`)
  }
}

// Check for updates (compare local vs remote)
async function checkUpdates(filePath: string): Promise<{
  hasUpdate: boolean
  localSize?: number
  remoteSize?: number
  error?: string
}> {
  try {
    const fullPath = path.join(BASE_DIR, filePath)
    
    // Get local file size
    let localSize = 0
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath)
      localSize = stats.size
    }
    
    // Download remote file
    const remoteContent = await downloadFile(filePath)
    const remoteSize = Buffer.byteLength(remoteContent, 'utf8')
    
    return {
      hasUpdate: localSize !== remoteSize || !fs.existsSync(fullPath),
      localSize,
      remoteSize
    }
  } catch (err: any) {
    return {
      hasUpdate: false,
      error: err.message
    }
  }
}

// List available backups
function listBackups(): string[] {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return []
    }
    
    const files = fs.readdirSync(BACKUP_DIR)
    return files.sort().reverse() // Most recent first
  } catch (err) {
    return []
  }
}

// Restore from backup
function restoreBackup(backupFileName: string): { success: boolean; error?: string } {
  try {
    const backupPath = path.join(BACKUP_DIR, backupFileName)
    
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup file not found' }
    }
    
    // Parse original file path from backup filename
    const parts = backupFileName.split('_')
    const dateIndex = parts.findIndex(p => p.match(/^\d{4}-\d{2}-\d{2}/))
    
    if (dateIndex === -1) {
      return { success: false, error: 'Invalid backup filename format' }
    }
    
    const originalPath = parts.slice(0, dateIndex).join('/')
    const targetPath = path.join(BASE_DIR, originalPath)
    
    // Ensure directory exists
    const dirPath = path.dirname(targetPath)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    
    fs.copyFileSync(backupPath, targetPath)
    console.log(`✅ Restored: ${originalPath}`)
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const plugin: PluginModule = {
  name: 'update',
  category: 'owner',
  commands: ['update', 'updateall', 'checkupdate', 'backup', 'restore'],
  access: 'owner',

  handler: async ({ event, text, command }, ctx) => {
    const peer = event.chatId ?? event.message?.chatId
    const params = text.trim().split(/\s+/)
    const subCommand = params[0]?.toLowerCase() || ''

    try {
      switch (command) {
        // UPDATE - Update single file
        case 'update': {
          if (!subCommand) {
            return ctx.client.sendMessage(peer, {
              message: 
                `📥 **Update Single File**\n\n` +
                `**Usage:** \`/update <file_path>\`\n\n` +
                `**Examples:**\n` +
                `• \`/update src/plugins/info/ping.ts\`\n` +
                `• \`/update src/index.ts\`\n` +
                `• \`/update package.json\`\n\n` +
                `File will be backed up automatically before update.`,
              parseMode: 'markdown'
            })
          }

          const filePath = subCommand
          const statusMsg = await ctx.client.sendMessage(peer, {
            message: `⏳ Updating **${filePath}**...\n\nDownloading from GitHub...`,
            parseMode: 'markdown'
          })

          try {
            const result = await updateFile(filePath)

            if (result.success) {
              await ctx.client.editMessage(peer, {
                message: statusMsg.id,
                text: 
                  `✅ **Update Successful!**\n\n` +
                  `📄 File: \`${filePath}\`\n` +
                  `💾 Backup: ${result.backup ? '✓' : '✗'}\n` +
                  `🔗 Source: [GitHub](${REPO_URL})\n\n` +
                  `File has been updated successfully!`,
                parseMode: 'markdown'
              })
            } else {
              await ctx.client.editMessage(peer, {
                message: statusMsg.id,
                text: 
                  `❌ **Update Failed**\n\n` +
                  `📄 File: \`${filePath}\`\n` +
                  `❗ Error: ${result.error}\n\n` +
                  `Please check the file path and try again.`,
                parseMode: 'markdown'
              })
            }
          } catch (err: any) {
            await ctx.client.editMessage(peer, {
              message: statusMsg.id,
              text: `❌ **Error:** ${err.message}`,
              parseMode: 'markdown'
            })
          }
          break
        }

        // UPDATEALL - Update all files
        case 'updateall': {
          const confirmMsg = await ctx.client.sendMessage(peer, {
            message: 
              `⚠️ **Update All Files**\n\n` +
              `This will update ALL files from the repository.\n` +
              `Existing files will be backed up automatically.\n\n` +
              `⏳ Starting update process...`,
            parseMode: 'markdown'
          })

          try {
            let lastUpdate = Date.now()
            
            const result = await updateAllFiles((current, total, file) => {
              // Update progress every 2 seconds to avoid flood
              const now = Date.now()
              if (now - lastUpdate > 2000) {
                lastUpdate = now
                
                const progress = Math.round((current / total) * 100)
                const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10))
                
                ctx.client.editMessage(peer, {
                  message: confirmMsg.id,
                  text: 
                    `⏳ **Updating Files...**\n\n` +
                    `${bar} ${progress}%\n` +
                    `${current}/${total} files\n\n` +
                    `Current: \`${file.substring(0, 30)}${file.length > 30 ? '...' : ''}\``,
                  parseMode: 'markdown'
                }).catch(() => {})
              }
            })

            const totalFiles = result.success + result.failed
            const successRate = Math.round((result.success / totalFiles) * 100)

            let errorList = ''
            if (result.errors.length > 0) {
              errorList = '\n\n**Errors:**\n'
              result.errors.slice(0, 5).forEach(e => {
                errorList += `• \`${e.file}\`: ${e.error}\n`
              })
              if (result.errors.length > 5) {
                errorList += `\n... and ${result.errors.length - 5} more errors`
              }
            }

            await ctx.client.editMessage(peer, {
              message: confirmMsg.id,
              text: 
                `${result.failed === 0 ? '✅' : '⚠️'} **Update Complete!**\n\n` +
                `📊 **Statistics:**\n` +
                `✓ Success: ${result.success}\n` +
                `✗ Failed: ${result.failed}\n` +
                `📈 Success Rate: ${successRate}%\n` +
                `💾 Backups: ${BACKUP_DIR}${errorList}\n\n` +
                `${result.failed === 0 ? 'All files updated successfully!' : 'Some files failed to update. Check errors above.'}`,
              parseMode: 'markdown'
            })

          } catch (err: any) {
            await ctx.client.editMessage(peer, {
              message: confirmMsg.id,
              text: `❌ **Update failed:** ${err.message}`,
              parseMode: 'markdown'
            })
          }
          break
        }

        // CHECKUPDATE - Check for updates
        case 'checkupdate': {
          if (!subCommand) {
            return ctx.client.sendMessage(peer, {
              message: 
                `🔍 **Check for Updates**\n\n` +
                `**Usage:** \`/checkupdate <file_path>\`\n\n` +
                `**Example:**\n` +
                `\`/checkupdate src/plugins/info/ping.ts\``,
              parseMode: 'markdown'
            })
          }

          const filePath = subCommand
          const checkingMsg = await ctx.client.sendMessage(peer, {
            message: `🔍 Checking updates for **${filePath}**...`,
            parseMode: 'markdown'
          })

          try {
            const result = await checkUpdates(filePath)

            if (result.error) {
              await ctx.client.editMessage(peer, {
                message: checkingMsg.id,
                text: `❌ **Error:** ${result.error}`,
                parseMode: 'markdown'
              })
            } else {
              const localExists = result.localSize && result.localSize > 0
              const status = result.hasUpdate ? '🆕 Update Available' : '✅ Up to Date'
              
              await ctx.client.editMessage(peer, {
                message: checkingMsg.id,
                text: 
                  `${status}\n\n` +
                  `📄 File: \`${filePath}\`\n` +
                  `📦 Local: ${localExists ? formatSize(result.localSize!) : 'Not found'}\n` +
                  `☁️ Remote: ${formatSize(result.remoteSize!)}\n\n` +
                  `${result.hasUpdate ? `Run \`/update ${filePath}\` to update.` : 'No update needed.'}`,
                parseMode: 'markdown'
              })
            }
          } catch (err: any) {
            await ctx.client.editMessage(peer, {
              message: checkingMsg.id,
              text: `❌ **Error:** ${err.message}`,
              parseMode: 'markdown'
            })
          }
          break
        }

        // BACKUP - List backups
        case 'backup': {
          const backups = listBackups()

          if (backups.length === 0) {
            return ctx.client.sendMessage(peer, {
              message: '📭 **No Backups Found**\n\nBackups will be created automatically when you update files.',
              parseMode: 'markdown'
            })
          }

          const backupList = backups.slice(0, 20).map((b, i) => {
            const stats = fs.statSync(path.join(BACKUP_DIR, b))
            return `${i + 1}. \`${b.substring(0, 40)}${b.length > 40 ? '...' : ''}\`\n   Size: ${formatSize(stats.size)}`
          }).join('\n\n')

          await ctx.client.sendMessage(peer, {
            message: 
              `💾 **Available Backups** (${backups.length})\n\n` +
              `${backupList}\n\n` +
              `${backups.length > 20 ? `... and ${backups.length - 20} more\n\n` : ''}` +
              `Use \`/restore <filename>\` to restore a backup.`,
            parseMode: 'markdown'
          })
          break
        }

        // RESTORE - Restore from backup
        case 'restore': {
          if (!subCommand) {
            return ctx.client.sendMessage(peer, {
              message: 
                `♻️ **Restore from Backup**\n\n` +
                `**Usage:** \`/restore <backup_filename>\`\n\n` +
                `Use \`/backup\` to see available backups.`,
              parseMode: 'markdown'
            })
          }

          const backupFile = subCommand
          const restoringMsg = await ctx.client.sendMessage(peer, {
            message: `⏳ Restoring from backup...`,
            parseMode: 'markdown'
          })

          try {
            const result = restoreBackup(backupFile)

            if (result.success) {
              await ctx.client.editMessage(peer, {
                message: restoringMsg.id,
                text: 
                  `✅ **Restore Successful!**\n\n` +
                  `💾 Backup: \`${backupFile.substring(0, 40)}${backupFile.length > 40 ? '...' : ''}\`\n\n` +
                  `File has been restored successfully!`,
                parseMode: 'markdown'
              })
            } else {
              await ctx.client.editMessage(peer, {
                message: restoringMsg.id,
                text: `❌ **Restore Failed:** ${result.error}`,
                parseMode: 'markdown'
              })
            }
          } catch (err: any) {
            await ctx.client.editMessage(peer, {
              message: restoringMsg.id,
              text: `❌ **Error:** ${err.message}`,
              parseMode: 'markdown'
            })
          }
          break
        }

        default: {
          return ctx.client.sendMessage(peer, {
            message: 
              `📥 **GitHub Auto Update**\n\n` +
              `**Commands:**\n` +
              `• \`/update <path>\` - Update single file\n` +
              `• \`/updateall\` - Update all files\n` +
              `• \`/checkupdate <path>\` - Check for updates\n` +
              `• \`/backup\` - List backups\n` +
              `• \`/restore <file>\` - Restore backup\n\n` +
              `**Repository:**\n` +
              `🔗 ${REPO_URL}\n\n` +
              `All files are backed up automatically before update.`,
            parseMode: 'markdown'
          })
        }
      }
    } catch (err: any) {
      await ctx.client.sendMessage(peer, {
        message: `❌ **Error:** ${err.message}`
      })
    }
  }
}

export default plugin