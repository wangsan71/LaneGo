const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();

cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [
    { name: 'commonName', value: 'LaneGo' },
    { name: 'countryName', value: 'TW' },
    { name: 'stateOrProvinceName', value: 'Taiwan' },
    { name: 'localityName', value: 'Taipei' },
    { name: 'organizationName', value: 'LaneGo' }
];

cert.setSubject(attrs);
cert.setIssuer(attrs);

cert.setExtensions([
    {
        name: 'basicConstraints',
        cA: true
    },
    {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
    },
    {
        name: 'subjectAltName',
        altNames: [
            { type: 2, value: 'localhost' },
            { type: 7, ip: '127.0.0.1' },
            { type: 7, ip: '0.0.0.0' }
        ]
    }
]);

cert.sign(keys.privateKey, forge.md.sha256.create());

const certPem = forge.pki.certificateToPem(cert);
const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

fs.writeFileSync(path.join(__dirname, 'cert.pem'), certPem);
fs.writeFileSync(path.join(__dirname, 'key.pem'), keyPem);

console.log('憑證已產生：cert.pem, key.pem');
