const axios = require('axios');
const crypto = require('crypto');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Configuration
const CONFIG = {
    output_dir: process.env.OUTPUT_DIR || "./accounts",
    proxy_url: "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=100000&country=all&ssl=all&anonymity=all",
    facebook_reg_url: "https://x.facebook.com/reg",
    facebook_submit_url: "https://www.facebook.com/reg/submit/"
};

// Ensure output directory exists
const fs = require('fs');
if (!fs.existsSync(CONFIG.output_dir)) {
    fs.mkdirSync(CONFIG.output_dir, { recursive: true });
}

// User-Agent list (simplified from original)
const userAgents = [];

// Generate random user agents (simplified version)
function generateUserAgents() {
    const models = ['CPH2461', 'M2004J19C', 'X676C', 'SM-G975F'];
    const androidVersions = ['10', '11', '12', '13'];
    
    for (let i = 0; i < 100; i++) {
        const model = models[Math.floor(Math.random() * models.length)];
        const androidVer = androidVersions[Math.floor(Math.random() * androidVersions.length)];
        const chromeVer = Math.floor(Math.random() * (114 - 80 + 1)) + 80;
        const buildVer = Math.floor(Math.random() * (5400 - 4200 + 1)) + 4200;
        const subVer = Math.floor(Math.random() * (150 - 70 + 1)) + 70;
        
        userAgents.push(`Mozilla/5.0 (Linux; Android ${androidVer}; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer}.0.${buildVer}.${subVer} Mobile Safari/537.36`);
    }
}

generateUserAgents();

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Name lists
const firstNames = [
    "Maria", "Ana", "Joy", "Grace", "Angel", "Angela", "Christine", "Kristine", "Michelle", "Shiela",
    "Sheila", "Maricel", "Marites", "Maribel", "Marjorie", "Jennifer", "Jenny", "Jessa", "Jessica", "Janine",
    "Katherine", "Catherine", "Kathleen", "Karen", "Karla", "Camille", "Bianca", "Patricia", "Patty", "Tricia"
];

const surnames = [
    "Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza",
    "Flores", "Gonzales", "Ramos", "Aquino", "DelaCruz", "DelosSantos",
    "Villanueva", "Fernandez", "Castillo", "Torres", "Dominguez", "Navarro"
];

function getRandomName() {
    return {
        firstname: firstNames[Math.floor(Math.random() * firstNames.length)],
        lastname: surnames[Math.floor(Math.random() * surnames.length)]
    };
}

function generatePassword() {
    const length = Math.floor(Math.random() * (12 - 8 + 1)) + 8;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset[Math.floor(Math.random() * charset.length)];
    }
    return password;
}

function generatePhoneNumber() {
    const prefixes = ['017', '018', '019', '016', '015', '013', '014'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return `+88${prefix}${number}`;
}

function generateTempEmail() {
    const name = getRandomName();
    const username = (name.firstname + name.lastname).toLowerCase().replace(/[^a-z]/g, '');
    const number = Math.floor(Math.random() * 9000) + 1000;
    return `${username}${number}@tempmail.com`;
}

// Extract form data from HTML
function extractFormData(html) {
    const formData = {};
    const inputRegex = /<input[^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["'][^>]*>/gi;
    let match;
    while ((match = inputRegex.exec(html)) !== null) {
        formData[match[1]] = match[2];
    }
    return formData;
}

// Check Facebook profile picture
async function checkFacebookProfilePicture(uid) {
    const picUrl = `https://graph.facebook.com/${uid}/picture?type=normal`;
    try {
        const response = await axios.get(picUrl, {
            headers: { 'User-Agent': getRandomUserAgent() },
            maxRedirects: 0,
            validateStatus: status => status === 302
        });
        const redirectUrl = response.headers.location || '';
        return redirectUrl.includes('scontent') ? 'live' : 'not_live';
    } catch (error) {
        return 'error';
    }
}

// Proxy handling
let proxiesList = [];

async function loadProxies() {
    try {
        const response = await axios.get(CONFIG.proxy_url);
        proxiesList = response.data.split('\n').filter(p => p.trim());
        return proxiesList;
    } catch (error) {
        return [];
    }
}

function getRandomProxy() {
    if (proxiesList.length > 0) {
        const proxy = proxiesList[Math.floor(Math.random() * proxiesList.length)];
        return { protocol: 'socks4', host: proxy.split(':')[0], port: parseInt(proxy.split(':')[1]) };
    }
    return null;
}

// Main account creation function
async function createFacebookAccount(method = 'basic', customPassword = null, showDetails = false) {
    const sessionData = {
        cookies: {},
        headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive'
        }
    };

    const name = getRandomName();
    const password = customPassword || generatePassword();
    const contact = method === 'email' ? generateTempEmail() : generatePhoneNumber();
    const birthday = {
        day: Math.floor(Math.random() * (28 - 20 + 1)) + 20,
        month: Math.floor(Math.random() * (25 - 5 + 1)) + 5,
        year: Math.floor(Math.random() * (2001 - 1990 + 1)) + 1990
    };

    try {
        // Step 1: Get registration page
        const regResponse = await axios.get(CONFIG.facebook_reg_url, {
            headers: sessionData.headers,
            withCredentials: true
        });

        // Extract cookies
        const cookies = regResponse.headers['set-cookie'];
        if (cookies) {
            cookies.forEach(cookie => {
                const [cookieData] = cookie.split(';');
                const [key, value] = cookieData.split('=');
                sessionData.cookies[key] = value;
            });
        }

        const formData = extractFormData(regResponse.data);

        // Step 2: Prepare registration payload
        const payload = {
            ccp: "2",
            reg_instance: formData.reg_instance || "",
            submission_request: "true",
            reg_impression_id: formData.reg_impression_id || "",
            ns: "1",
            logger_id: formData.logger_id || "",
            firstname: name.firstname,
            lastname: name.lastname,
            birthday_day: birthday.day.toString(),
            birthday_month: birthday.month.toString(),
            birthday_year: birthday.year.toString(),
            reg_email__: contact,
            sex: "1", // Female
            encpass: `#PWD_BROWSER:0:${Math.floor(Date.now() / 1000)}:${password}`,
            submit: "Sign Up",
            fb_dtsg: formData.fb_dtsg || "",
            jazoest: formData.jazoest || "",
            lsd: formData.lsd || ""
        };

        // Step 3: Submit registration
        const submitResponse = await axios.post(CONFIG.facebook_submit_url, 
            new URLSearchParams(payload).toString(),
            {
                headers: {
                    ...sessionData.headers,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://mbasic.facebook.com/reg/'
                },
                withCredentials: true
            }
        );

        // Extract final cookies
        const finalCookies = submitResponse.headers['set-cookie'];
        if (finalCookies) {
            finalCookies.forEach(cookie => {
                const [cookieData] = cookie.split(';');
                const [key, value] = cookieData.split('=');
                sessionData.cookies[key] = value;
            });
        }

        // Step 4: Check if account was created
        if (sessionData.cookies.c_user) {
            const uid = sessionData.cookies.c_user;
            let status = 'created';
            
            // Check profile picture if method is enhanced
            if (method === 'enhanced') {
                const picStatus = await checkFacebookProfilePicture(uid);
                status = picStatus === 'live' ? 'live' : 'created';
            }
            
            const cookieString = Object.entries(sessionData.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join(';');
            
            const accountData = {
                uid: uid,
                email: contact,
                password: password,
                firstname: name.firstname,
                lastname: name.lastname,
                birthday: `${birthday.day}-${birthday.month}-${birthday.year}`,
                gender: 'Female',
                status: status,
                cookies: cookieString,
                created_at: new Date().toISOString()
            };
            
            // Save to file
            const logFile = `${CONFIG.output_dir}/accounts_${new Date().toISOString().split('T')[0]}.txt`;
            fs.appendFileSync(logFile, `${uid}|${contact}|${password}|${cookieString}\n`);
            
            return accountData;
        } else if (sessionData.cookies.checkpoint) {
            return {
                status: 'checkpoint',
                email: contact,
                password: password,
                error: 'Account requires verification checkpoint'
            };
        } else {
            return {
                status: 'failed',
                email: contact,
                password: password,
                error: 'Registration failed - no c_user cookie'
            };
        }
        
    } catch (error) {
        return {
            status: 'error',
            email: contact,
            password: password,
            error: error.message
        };
    }
}

// Bulk account creation
async function createBulkAccounts(count, method = 'basic', customPassword = null, showDetails = false) {
    const results = {
        success: [],
        failed: [],
        checkpoints: [],
        total: count,
        completed: 0,
        startTime: new Date()
    };
    
    for (let i = 0; i < count; i++) {
        const result = await createFacebookAccount(method, customPassword, showDetails);
        
        if (result.status === 'created' || result.status === 'live') {
            results.success.push(result);
        } else if (result.status === 'checkpoint') {
            results.checkpoints.push(result);
        } else {
            results.failed.push(result);
        }
        
        results.completed = i + 1;
        
        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    results.endTime = new Date();
    results.duration = (results.endTime - results.startTime) / 1000;
    
    return results;
}

// API Endpoints
const meta = {
    name: 'fbmaker',
    path: '/facebook',
    method: 'get',
    category: 'tools'
};

async function onStart({ req, res }) {
    const { action, method = 'basic', count = 1, password, showDetails = false } = req.body;
    
    switch (action) {
        case 'create':
            if (count > 1) {
                const results = await createBulkAccounts(parseInt(count), method, password, showDetails);
                res.json({
                    success: true,
                    data: results,
                    message: `Created ${results.success.length} accounts, ${results.checkpoints.length} checkpoints, ${results.failed.length} failed`
                });
            } else {
                const result = await createFacebookAccount(method, password, showDetails);
                res.json({
                    success: result.status === 'created' || result.status === 'live',
                    data: result
                });
            }
            break;
            
        case 'generate-password':
            res.json({
                success: true,
                password: generatePassword()
            });
            break;
            
        case 'generate-phone':
            res.json({
                success: true,
                phone: generatePhoneNumber(),
                email: generateTempEmail()
            });
            break;
            
        case 'generate-name':
            res.json({
                success: true,
                name: getRandomName()
            });
            break;
            
        case 'load-proxies':
            const proxies = await loadProxies();
            res.json({
                success: true,
                proxies: proxies,
                count: proxies.length
            });
            break;
            
        default:
            res.status(400).json({
                success: false,
                error: 'Invalid action. Available: create, generate-password, generate-phone, generate-name, load-proxies'
            });
    }
}

// Health check endpoint
const healthMeta = {
    name: 'Health Check',
    path: '/facebook/health',
    method: 'get',
    category: 'system'
};

async function healthCheck({ req, res }) {
    res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        config: {
            output_dir: CONFIG.output_dir,
            proxies_loaded: proxiesList.length
        }
    });
}

// Get accounts endpoint
const accountsMeta = {
    name: 'Get Created Accounts',
    path: '/facebook/accounts',
    method: 'get',
    category: 'social'
};

async function getAccounts({ req, res }) {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const logFile = `${CONFIG.output_dir}/accounts_${date}.txt`;
    
    if (!fs.existsSync(logFile)) {
        return res.json({
            success: false,
            error: 'No accounts found for the specified date'
        });
    }
    
    const content = fs.readFileSync(logFile, 'utf-8');
    const accounts = content.split('\n')
        .filter(line => line.trim())
        .map(line => {
            const [uid, email, password, cookies] = line.split('|');
            return { uid, email, password, cookies };
        });
    
    res.json({
        success: true,
        accounts: accounts,
        count: accounts.length
    });
}

// Statistics endpoint
const statsMeta = {
    name: 'Account Statistics',
    path: '/facebook/stats',
    method: 'get',
    category: 'system'
};

async function getStats({ req, res }) {
    const files = fs.readdirSync(CONFIG.output_dir);
    const accountFiles = files.filter(f => f.startsWith('accounts_'));
    
    let totalAccounts = 0;
    const dailyStats = {};
    
    accountFiles.forEach(file => {
        const content = fs.readFileSync(`${CONFIG.output_dir}/${file}`, 'utf-8');
        const accounts = content.split('\n').filter(line => line.trim());
        const date = file.replace('accounts_', '').replace('.txt', '');
        dailyStats[date] = accounts.length;
        totalAccounts += accounts.length;
    });
    
    res.json({
        success: true,
        statistics: {
            total_accounts: totalAccounts,
            daily_breakdown: dailyStats,
            output_directory: CONFIG.output_dir,
            last_updated: new Date().toISOString()
        }
    });
}

module.exports = { 
    meta, 
    onStart,
    health: { meta: healthMeta, onStart: healthCheck },
    accounts: { meta: accountsMeta, onStart: getAccounts },
    stats: { meta: statsMeta, onStart: getStats }
};