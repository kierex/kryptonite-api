const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const meta = {
  name: 'fbmaker',
  path: '/fbmaker',
  method: 'get',
  category: 'tools',
  author: 'Rynn API'
};

// Configuration
const CONFIG = {
    output_dir: path.join(__dirname, '..', 'accounts'),
    facebook_reg_url: "https://x.facebook.com/reg",
    facebook_submit_url: "https://www.facebook.com/reg/submit/",
    timeout: 30000,
    retry_attempts: 2,
    delay_between_requests: 2000
};

// Ensure output directory exists
fs.ensureDirSync(CONFIG.output_dir);

// User-Agent generation
const userAgents = [];

function generateUserAgents() {
    const models = ['CPH2461', 'M2004J19C', 'X676C', 'SM-G975F', 'Redmi Note 8', 'Infinix X689C'];
    const androidVersions = ['10', '11', '12', '13', '14'];
    
    for (let i = 0; i < 200; i++) {
        const model = models[Math.floor(Math.random() * models.length)];
        const androidVer = androidVersions[Math.floor(Math.random() * androidVersions.length)];
        const chromeVer = Math.floor(Math.random() * (120 - 80 + 1)) + 80;
        const buildVer = Math.floor(Math.random() * (5900 - 4200 + 1)) + 4200;
        const subVer = Math.floor(Math.random() * (200 - 70 + 1)) + 70;
        
        userAgents.push(`Mozilla/5.0 (Linux; Android ${androidVer}; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer}.0.${buildVer}.${subVer} Mobile Safari/537.36`);
    }
}

generateUserAgents();

function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Name lists
const firstNames = [
    "Maria", "Ana", "Joy", "Grace", "Angel", "Angela", "Christine", "Kristine", 
    "Michelle", "Shiela", "Sheila", "Maricel", "Marites", "Maribel", "Marjorie", 
    "Jennifer", "Jenny", "Jessa", "Jessica", "Janine", "Katherine", "Catherine", 
    "Kathleen", "Karen", "Karla", "Camille", "Bianca", "Patricia", "Patty", "Tricia"
];

const surnames = [
    "Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Flores", 
    "Gonzales", "Ramos", "Aquino", "DelaCruz", "DelosSantos", "Villanueva", 
    "Fernandez", "Castillo", "Torres", "Dominguez", "Navarro", "Salazar"
];

function getRandomName() {
    return {
        firstname: firstNames[Math.floor(Math.random() * firstNames.length)],
        lastname: surnames[Math.floor(Math.random() * surnames.length)]
    };
}

function generatePassword() {
    const length = Math.floor(Math.random() * (12 - 8 + 1)) + 8;
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%^&*';
    
    let password = '';
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += digits[Math.floor(Math.random() * digits.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    const all = upper + lower + digits + symbols;
    for (let i = password.length; i < length; i++) {
        password += all[Math.floor(Math.random() * all.length)];
    }
    
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

function generatePhoneNumber() {
    const prefixes = ['017', '018', '019', '016', '015', '013', '014'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return `${prefix}${number}`;
}

function generateTempEmail() {
    const name = getRandomName();
    const username = (name.firstname + name.lastname).toLowerCase().replace(/[^a-z]/g, '');
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'tempmail.com', '10minutemail.com'];
    const number = Math.floor(Math.random() * 9000) + 1000;
    return `${username}${number}@${domains[Math.floor(Math.random() * domains.length)]}`;
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
            validateStatus: status => status === 302,
            timeout: 10000
        });
        const redirectUrl = response.headers.location || '';
        return redirectUrl.includes('scontent') ? 'live' : 'default';
    } catch (error) {
        return 'error';
    }
}

// Main account creation function
async function createFacebookAccount(contactType = 'phone', customPassword = null, enableCheck = false) {
    const sessionData = {
        cookies: {},
        headers: {
            'User-Agent': getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
    };

    const name = getRandomName();
    const password = customPassword || generatePassword();
    const contact = contactType === 'email' ? generateTempEmail() : generatePhoneNumber();
    const birthday = {
        day: Math.floor(Math.random() * (28 - 10 + 1)) + 10,
        month: Math.floor(Math.random() * (12 - 1 + 1)) + 1,
        year: Math.floor(Math.random() * (2005 - 1985 + 1)) + 1985
    };

    try {
        // Get registration page
        const regResponse = await axios.get(CONFIG.facebook_reg_url, {
            headers: sessionData.headers,
            timeout: 30000
        });

        // Extract cookies
        const cookies = regResponse.headers['set-cookie'];
        if (cookies) {
            cookies.forEach(cookie => {
                const [cookieData] = cookie.split(';');
                const [key, value] = cookieData.split('=');
                if (key && value) sessionData.cookies[key] = value;
            });
        }

        const formData = extractFormData(regResponse.data);

        // Prepare registration payload
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
            sex: Math.random() > 0.3 ? "1" : "2",
            encpass: `#PWD_BROWSER:0:${Math.floor(Date.now() / 1000)}:${password}`,
            submit: "Sign Up",
            fb_dtsg: formData.fb_dtsg || "",
            jazoest: formData.jazoest || "",
            lsd: formData.lsd || ""
        };

        // Submit registration
        const submitResponse = await axios.post(CONFIG.facebook_submit_url, 
            new URLSearchParams(payload).toString(),
            {
                headers: {
                    ...sessionData.headers,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://mbasic.facebook.com/reg/',
                    'Origin': 'https://mbasic.facebook.com'
                },
                timeout: 30000
            }
        );

        // Extract final cookies
        const finalCookies = submitResponse.headers['set-cookie'];
        if (finalCookies) {
            finalCookies.forEach(cookie => {
                const [cookieData] = cookie.split(';');
                const [key, value] = cookieData.split('=');
                if (key && value) sessionData.cookies[key] = value;
            });
        }

        // Check if account was created
        if (sessionData.cookies.c_user) {
            const uid = sessionData.cookies.c_user;
            let status = 'success';
            let picStatus = 'not_checked';
            
            if (enableCheck) {
                picStatus = await checkFacebookProfilePicture(uid);
                status = picStatus === 'live' ? 'live' : 'success';
            }
            
            const cookieString = Object.entries(sessionData.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join(';');
            
            const accountData = {
                success: true,
                uid: uid,
                contact: contact,
                contact_type: contactType,
                password: password,
                firstname: name.firstname,
                lastname: name.lastname,
                fullname: `${name.firstname} ${name.lastname}`,
                birthday: `${birthday.day}/${birthday.month}/${birthday.year}`,
                gender: payload.sex === "1" ? 'Female' : 'Male',
                status: status,
                picture_status: picStatus,
                cookies: cookieString,
                timestamp: Math.floor(Date.now() / 1000),
                created_at: new Date().toISOString()
            };
            
            // Save to file
            const logFile = path.join(CONFIG.output_dir, `accounts_${new Date().toISOString().split('T')[0]}.txt`);
            await fs.appendFile(logFile, `${uid}|${contact}|${password}|${cookieString}|${status}\n`);
            
            return accountData;
        } else {
            return {
                success: false,
                error: 'Registration failed - no c_user cookie',
                contact: contact,
                password: password,
                checkpoint_detected: !!sessionData.cookies.checkpoint
            };
        }
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            contact: contact,
            password: password
        };
    }
}

// Bulk account creation
async function createBulkAccounts(count, contactType = 'phone', customPassword = null, enableCheck = false) {
    const results = {
        success: [],
        failed: [],
        total_requested: count,
        completed: 0,
        start_time: new Date().toISOString()
    };
    
    for (let i = 0; i < count; i++) {
        const result = await createFacebookAccount(contactType, customPassword, enableCheck);
        
        if (result.success) {
            results.success.push(result);
        } else {
            results.failed.push(result);
        }
        
        results.completed = i + 1;
        
        // Delay to avoid rate limiting
        if (i < count - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    results.end_time = new Date().toISOString();
    results.duration_seconds = (new Date(results.end_time) - new Date(results.start_time)) / 1000;
    
    // Save summary
    const summaryFile = path.join(CONFIG.output_dir, `summary_${Date.now()}.json`);
    await fs.writeJson(summaryFile, results, { spaces: 2 });
    
    return results;
}

// Main onStart function
async function onStart({ req, res }) {
    const { 
        action = 'create',
        type = 'phone',
        count = 1,
        password = null,
        check = false,
        format = 'json'
    } = req.query;

    try {
        // Validate count
        const numCount = parseInt(count);
        if (isNaN(numCount) || numCount < 1 || numCount > 50) {
            return res.status(400).json({
                success: false,
                error: 'Count must be between 1 and 50',
                operator: 'Rynn API'
            });
        }

        // Validate type
        if (type !== 'phone' && type !== 'email') {
            return res.status(400).json({
                success: false,
                error: 'Type must be "phone" or "email"',
                operator: 'Rynn API'
            });
        }

        // Validate action
        if (action === 'create') {
            if (numCount === 1) {
                const result = await createFacebookAccount(type, password, check === 'true');
                
                if (format === 'text') {
                    if (result.success) {
                        res.send(`SUCCESS|${result.uid}|${result.contact}|${result.password}|${result.fullname}\n`);
                    } else {
                        res.send(`FAILED|${result.error}|${result.contact}|${result.password}\n`);
                    }
                } else {
                    res.json({
                        success: result.success,
                        data: result,
                        operator: 'Rynn API'
                    });
                }
            } else {
                const results = await createBulkAccounts(numCount, type, password, check === 'true');
                
                if (format === 'text') {
                    let output = `SUMMARY|Success:${results.success.length}|Failed:${results.failed.length}|Total:${results.total_requested}\n`;
                    output += `DURATION|${results.duration_seconds} seconds\n`;
                    output += `START|${results.start_time}\n`;
                    output += `END|${results.end_time}\n`;
                    output += `\n--- SUCCESSFUL ACCOUNTS ---\n`;
                    results.success.forEach(acc => {
                        output += `SUCCESS|${acc.uid}|${acc.contact}|${acc.password}|${acc.fullname}\n`;
                    });
                    output += `\n--- FAILED ATTEMPTS ---\n`;
                    results.failed.forEach(acc => {
                        output += `FAILED|${acc.error}|${acc.contact}|${acc.password}\n`;
                    });
                    res.send(output);
                } else {
                    res.json({
                        success: true,
                        data: results,
                        operator: 'Rynn API'
                    });
                }
            }
        } 
        else if (action === 'generate') {
            if (type === 'phone') {
                res.json({
                    success: true,
                    phone: generatePhoneNumber(),
                    password: generatePassword(),
                    name: getRandomName(),
                    operator: 'Rynn API'
                });
            } else {
                res.json({
                    success: true,
                    email: generateTempEmail(),
                    password: generatePassword(),
                    name: getRandomName(),
                    operator: 'Rynn API'
                });
            }
        }
        else if (action === 'stats') {
            const files = await fs.readdir(CONFIG.output_dir);
            const accountFiles = files.filter(f => f.startsWith('accounts_'));
            
            let totalAccounts = 0;
            for (const file of accountFiles) {
                const content = await fs.readFile(path.join(CONFIG.output_dir, file), 'utf-8');
                totalAccounts += content.split('\n').filter(line => line.trim()).length;
            }
            
            res.json({
                success: true,
                total_accounts: totalAccounts,
                output_directory: CONFIG.output_dir,
                files_count: accountFiles.length,
                operator: 'Rynn API'
            });
        }
        else if (action === 'health') {
            res.json({
                success: true,
                status: 'running',
                endpoints: {
                    create: '/api/fbmaker?action=create&type=phone&count=1',
                    generate: '/api/fbmaker?action=generate&type=phone',
                    stats: '/api/fbmaker?action=stats'
                },
                operator: 'Rynn API'
            });
        }
        else {
            res.status(400).json({
                success: false,
                error: 'Invalid action. Use: create, generate, stats, or health',
                operator: 'Rynn API'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            operator: 'Rynn API'
        });
    }
}

module.exports = { meta, onStart };