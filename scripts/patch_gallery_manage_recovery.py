from pathlib import Path

path = Path('src/lib/gallery-manage-controller.mjs')
source = path.read_text(encoding='utf-8')

old_import = """import {\n  addIndexEntries,\n  parseGalleryIndex,\n  planUploadPaths,\n  removeIndexEntry,\n  serializeGalleryIndex,\n} from './gallery-index-transaction.mjs';\n"""
new_import = """import {\n  parseGalleryIndex,\n  patchGalleryIndexPayload,\n  planUploadPaths,\n} from './gallery-index-transaction.mjs';\n"""
if old_import in source:
    source = source.replace(old_import, new_import, 1)
elif "patchGalleryIndexPayload" not in source:
    raise SystemExit('index import block not found')

old_session = """export function createTokenSession() {\n  let token = '';\n  return {\n    get() { return token; },\n    set(nextToken) { token = String(nextToken || '').trim(); },\n    clear() { token = ''; },\n  };\n}\n"""
new_session = """export const GALLERY_TOKEN_SESSION_KEY = 'lidure_gallery_github_token_v1';\n\nfunction defaultTokenStorage() {\n  try { return globalThis.sessionStorage ?? null; }\n  catch { return null; }\n}\n\nexport function createTokenSession(storage = defaultTokenStorage()) {\n  let fallback = '';\n  return {\n    get() {\n      try {\n        if (storage?.getItem) return String(storage.getItem(GALLERY_TOKEN_SESSION_KEY) || '').trim();\n      } catch {}\n      return fallback;\n    },\n    set(nextToken) {\n      const token = String(nextToken || '').trim();\n      fallback = token;\n      try {\n        if (token) storage?.setItem?.(GALLERY_TOKEN_SESSION_KEY, token);\n        else storage?.removeItem?.(GALLERY_TOKEN_SESSION_KEY);\n      } catch {}\n    },\n    clear() {\n      fallback = '';\n      try { storage?.removeItem?.(GALLERY_TOKEN_SESSION_KEY); } catch {}\n    },\n  };\n}\n"""
if old_session in source:
    source = source.replace(old_session, new_session, 1)
elif "GALLERY_TOKEN_SESSION_KEY" not in source:
    raise SystemExit('token session block not found')

old_state = """    remoteTree: [],\n    galleryIndex: {},\n    manifestSha: null,\n"""
new_state = """    remoteTree: [],\n    galleryIndex: {},\n    galleryIndexPayload: null,\n    manifestSha: null,\n"""
if old_state in source:
    source = source.replace(old_state, new_state, 1)
elif "galleryIndexPayload" not in source:
    raise SystemExit('state block not found')

source = source.replace(
    "Token 只保存在当前页面内存中；刷新、离开或断开连接后立即清空。",
    "Token 只保存在当前浏览器会话中；刷新或离开后可自动恢复，断开连接、凭据失效或关闭浏览器会话后清空。",
    1,
)

old_sync = """    const content = manifestResponse.data?.content;\n    if (!content) throw new Error('无法读取远端图库索引');\n    const index = parseGalleryIndex(JSON.parse(base64ToUtf8(content)));\n    if (disposed || generation !== state.syncGeneration) return;\n    state.remoteTree = snapshot.tree;\n    state.galleryIndex = index;\n    state.manifestSha = manifestEntry.sha;\n"""
new_sync = """    const content = manifestResponse.data?.content;\n    if (!content) throw new Error('无法读取远端图库索引');\n    const indexPayload = JSON.parse(base64ToUtf8(content));\n    const index = parseGalleryIndex(indexPayload);\n    if (disposed || generation !== state.syncGeneration) return;\n    state.remoteTree = snapshot.tree;\n    state.galleryIndex = index;\n    state.galleryIndexPayload = indexPayload;\n    state.manifestSha = manifestEntry.sha;\n"""
if old_sync in source:
    source = source.replace(old_sync, new_sync, 1)
elif "state.galleryIndexPayload = indexPayload" not in source:
    raise SystemExit('syncRemote block not found')

old_connect = """  async function connect() {\n    if (state.connected) {\n      tokenSession.clear();\n      state.connected = false;\n      state.client = null;\n      state.remoteTree = [];\n      state.galleryIndex = {};\n      state.manifestSha = null;\n      renderAll();\n      await loadPublic(true);\n      return;\n    }\n    const token = await promptToken(connectButton);\n    if (!token || disposed) return;\n    setBusy(true);\n    setStatus('正在验证 GitHub 权限…', 'loading');\n    tokenSession.set(token);\n    const client = githubClientFactory({ token: tokenSession.get() });\n    try {\n      await client.validateWriteAccess();\n      state.client = client;\n      state.connected = true;\n      await syncRemote();\n      setBusy(false);\n      renderAll();\n    } catch (error) {\n      tokenSession.clear();\n      state.client = null;\n      state.connected = false;\n      setBusy(false);\n      renderAll();\n      setStatus(error?.message || 'GitHub 连接失败', 'error');\n    }\n  }\n\n"""
new_connect = """  async function connect() {\n    if (state.connected) {\n      tokenSession.clear();\n      state.connected = false;\n      state.client = null;\n      state.remoteTree = [];\n      state.galleryIndex = {};\n      state.galleryIndexPayload = null;\n      state.manifestSha = null;\n      renderAll();\n      await loadPublic(true);\n      return;\n    }\n    const token = await promptToken(connectButton);\n    if (!token || disposed) return;\n    setBusy(true);\n    setStatus('正在验证 GitHub 权限…', 'loading');\n    const client = githubClientFactory({ token });\n    try {\n      await client.validateWriteAccess();\n      state.client = client;\n      state.connected = true;\n      await syncRemote();\n      tokenSession.set(token);\n      setBusy(false);\n      renderAll();\n    } catch (error) {\n      tokenSession.clear();\n      state.client = null;\n      state.connected = false;\n      state.remoteTree = [];\n      state.galleryIndex = {};\n      state.galleryIndexPayload = null;\n      state.manifestSha = null;\n      setBusy(false);\n      renderAll();\n      setStatus(error?.message || 'GitHub 连接失败', 'error');\n    }\n  }\n\n  async function restoreSavedConnection() {\n    const token = tokenSession.get();\n    if (!token) {\n      await loadPublic(false);\n      return;\n    }\n    setBusy(true);\n    setStatus('正在恢复 GitHub 会话…', 'loading');\n    const client = githubClientFactory({ token });\n    try {\n      await client.validateWriteAccess();\n      if (disposed) return;\n      state.client = client;\n      state.connected = true;\n      await syncRemote();\n      if (disposed) return;\n      renderAll();\n    } catch (error) {\n      tokenSession.clear();\n      state.client = null;\n      state.connected = false;\n      state.remoteTree = [];\n      state.galleryIndex = {};\n      state.galleryIndexPayload = null;\n      state.manifestSha = null;\n      if (!disposed) {\n        await loadPublic(false);\n        if (error?.code === 'auth') setStatus('GitHub 会话已失效，请重新连接', 'error');\n      }\n    } finally {\n      if (!disposed) {\n        setBusy(false);\n        renderAll();\n      }\n    }\n  }\n\n"""
if old_connect in source:
    source = source.replace(old_connect, new_connect, 1)
elif "async function restoreSavedConnection()" not in source:
    raise SystemExit('connect block not found')

old_upload = """      const nextIndex = addIndexEntries(state.galleryIndex, planned);\n      const manifestBase64 = utf8ToBase64(serializeGalleryIndex(nextIndex));\n"""
new_upload = """      if (!state.galleryIndexPayload) throw new Error('无法确认远端图库索引内容');\n      const upserts = Object.fromEntries(planned.map(plan => [plan.path, plan.perceptualHash]));\n      const plannedMaxIndex = planned.reduce((max, plan) => {\n        const fileName = plan.path.split('/').pop() || '';\n        const value = Number(fileName.slice(0, fileName.lastIndexOf('.')));\n        return Number.isSafeInteger(value) ? Math.max(max, value) : max;\n      }, Number(state.galleryIndexPayload.max_index) || 0);\n      const nextIndexPayload = patchGalleryIndexPayload(state.galleryIndexPayload, {\n        upserts,\n        maxIndex: plannedMaxIndex,\n      });\n      const manifestBase64 = utf8ToBase64(JSON.stringify(nextIndexPayload));\n"""
if old_upload in source:
    source = source.replace(old_upload, new_upload, 1)
elif "const nextIndexPayload = patchGalleryIndexPayload" not in source:
    raise SystemExit('upload manifest block not found')

old_delete = """      const currentManifestSha = state.manifestSha;\n      if (!currentManifestSha) throw new Error('无法确认远端图库索引版本');\n      const nextIndex = removeIndexEntry(state.galleryIndex, image.path);\n      await commitGitHubDeleteTransaction({\n        owner: 'Lidure',\n        repo: 'airi-gallery-images',\n        branch: GALLERY_BRANCH,\n        request: state.client.request,\n        imagePath: image.path,\n        manifest: {\n          path: GALLERY_INDEX_PATH,\n          contentBase64: utf8ToBase64(serializeGalleryIndex(nextIndex)),\n          expectedSha: currentManifestSha,\n        },\n      });\n"""
new_delete = """      const currentManifestSha = state.manifestSha;\n      if (!currentManifestSha || !state.galleryIndexPayload) throw new Error('无法确认远端图库索引版本');\n      const nextIndexPayload = patchGalleryIndexPayload(state.galleryIndexPayload, {\n        removePaths: [image.path],\n      });\n      await commitGitHubDeleteTransaction({\n        owner: 'Lidure',\n        repo: 'airi-gallery-images',\n        branch: GALLERY_BRANCH,\n        request: state.client.request,\n        imagePath: image.path,\n        manifest: {\n          path: GALLERY_INDEX_PATH,\n          contentBase64: utf8ToBase64(JSON.stringify(nextIndexPayload)),\n          expectedSha: currentManifestSha,\n        },\n      });\n"""
if old_delete in source:
    source = source.replace(old_delete, new_delete, 1)
elif "removePaths: [image.path]" not in source:
    raise SystemExit('delete manifest block not found')

old_init = """  updateWriteControls();\n  loadPublic(false);\n\n  return () => {\n    if (disposed) return;\n    disposed = true;\n    abortController.abort();\n    state.syncGeneration += 1;\n    tokenSession.clear();\n    closeDialog(null);\n"""
new_init = """  updateWriteControls();\n  restoreSavedConnection();\n\n  return () => {\n    if (disposed) return;\n    disposed = true;\n    abortController.abort();\n    state.syncGeneration += 1;\n    closeDialog(null);\n"""
if old_init in source:
    source = source.replace(old_init, new_init, 1)
elif "restoreSavedConnection();" not in source:
    raise SystemExit('initialization/cleanup block not found')

path.write_text(source, encoding='utf-8')
